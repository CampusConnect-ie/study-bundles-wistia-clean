const parseArgs = require('minimist')
const Fs = require('fs')
const Prompt = require('prompt')
const mongojs = require('mongojs')
const wistiajs = require('wistia-js')
const debug = require('debug')('wistia-clean')
const Async = require('async')

const PER_PAGE = 100
const CONCURRENCY = 5

// Setup the MongoDB and Wistia client
function getContext (argv, cb) {
  Async.auto({
    db: (cb) => {
      const mongoUri = argv['mongo-uri'] || 'mongodb://localhost/studybundles'
      cb(null, mongojs(mongoUri, ['bundles']))
    },

    wistiaApiPassword: (cb) => {
      if (!argv['settings-path']) {
        return cb(null, argv['wistia-api-password'])
      }

      Fs.readFile(argv['settings-path'], (err, settingsData) => {
        if (err) return cb(err)

        let wistiaApiPassword

        try {
          wistiaApiPassword = JSON.parse(settingsData).wistia.apiPassword
        } catch (err) {
          return cb(err)
        }

        cb(null, wistiaApiPassword)
      })
    },

    wistia: ['wistiaApiPassword', (res, cb) => {
      if (!res.wistiaApiPassword) {
        return cb(new Error('--wistia-api-password or --settings-path required'))
      }
      cb(null, wistiajs(res.wistiaApiPassword).WistiaData())
    }]
  }, cb)
}

// Find all the bundles with wistia projects, including deleted
function findBundles (db, cb) {
  db.bundles.find({ 'wistia.project': { $exists: true } }, cb)
}

// Fetch all the Wistia projects
function fetchProjects (wistia, cb) {
  let allProjects = []
  let page = 1
  let hasMore = true

  const iteratee = (cb) => {
    debug(`Getting projects page ${page}`)

    wistia.projectList({ page, per_page: PER_PAGE }, (err, data) => {
      if (err) return cb(err)

      const projects = JSON.parse(data)
      debug(`Found ${projects.length} in page ${page}`)

      allProjects = allProjects.concat(projects)
      hasMore = projects.length >= PER_PAGE
      page++

      cb()
    })
  }

  Async.doWhilst(iteratee, () => hasMore, (err) => cb(err, allProjects))
}

// Fetch all the media in a given project
function fetchMedia (wistia, projectId, cb) {
  let allMedia = []
  let page = 1
  let hasMore = true

  const iteratee = (cb) => {
    debug(`Getting media page ${page} of project ${projectId}`)

    wistia.mediaList(projectId, page, PER_PAGE, (err, data) => {
      if (err) return cb(err)

      const media = JSON.parse(data)
      debug(`Found ${media.length} in page ${page} of project ${projectId}`)

      allMedia = allMedia.concat(media)
      hasMore = media.length >= PER_PAGE
      page++

      cb()
    })
  }

  Async.doWhilst(iteratee, () => hasMore, (err) => cb(err, allMedia))
}

// Fetch all the projects, and all the media in each project
function fetchProjectsAndMedia (wistia, cb) {
  fetchProjects(wistia, (err, projects) => {
    if (err) return cb(err)

    Async.mapLimit(projects, CONCURRENCY, (project, cb) => {
      fetchMedia(wistia, project.id, (err, media) => {
        project.media = media
        cb(err, project)
      })
    }, cb)
  })
}

// Does the bundle currently contain the wistia media (video)
const containsMedia = (bundle, media) => {
  return bundle.videos.some((v) => v.wistia.video.id === media.id)
}

// Get projects that exist on wistia, that used to belong to the deleted bundles
function getOrphanedProjects (deletedBundles, allProjects) {
  debug(`Finding project orphans in ${deletedBundles.length} DELETED bundles`)

  return deletedBundles.reduce((orphans, bundle) => {
    const project = allProjects.find((p) => p.id === bundle.wistia.project.id)

    if (!project) {
      debug(`Project ${bundle.wistia.project.id} not found for bundle ${bundle._id}`)
      return orphans
    }

    return orphans.concat(project)
  }, [])
}

// Get media that exists in the project in wistia, but is no longer part of the bundle
function getOrphanedMedia (activeBundles, allProjects) {
  debug(`Finding media orphans in ${activeBundles.length} ACTIVE bundles`)

  return activeBundles.reduce((orphans, bundle) => {
    const project = allProjects.find((p) => p.id === bundle.wistia.project.id)

    if (!project) {
      debug(`Project ${bundle.wistia.project.id} not found for bundle ${bundle._id}`)
      return orphans
    }

    const projectOrphans = project.media.filter((m) => !containsMedia(bundle, m))
    return orphans.concat(projectOrphans)
  }, [])
}

// Print a summary of what tasks will be performed
function printSummary (orphanedProjects, orphanedMedia) {
  const out = []

  if (orphanedProjects.length) {
    out.push('Wistia PROJECTS attached to DELETED bundles to be REMOVED:')
    orphanedProjects.forEach((p) => out.push(`    ${p.id} ${p.name}`))
  }

  if (orphanedMedia.length) {
    if (out.length) out.push('')
    out.push('Wistia MEDIA NOT attached to ACTIVE bundles to be REMOVED:')
    orphanedMedia.forEach((m) => out.push(`    ${m.id} ${m.name}`))
  }

  console.log(out.join('\n'))
}

// Ask the user if the script should continue
function confirm (cb) {
  Prompt.start()

  Prompt.get({
    properties: { cont: { description: 'Do you want to continue? [Y/n]' } }
  }, (err, res) => {
    if (err) return cb(err)
    cb(null, ['Y', 'y'].indexOf(res.cont) > -1)
  })
}

function deleteProjects (wistia, projects, cb) {
  Async.eachLimit(projects, CONCURRENCY, (p, cb) => {
    debug(`Deleting project ${p.id} (${p.hashedId})`)
    wistia.projectDelete(p.hashedId, cb)
  })
}

function deleteMedia (wistia, media, cb) {
  Async.eachLimit(media, CONCURRENCY, (m, cb) => {
    debug(`Deleting media ${m.id} (${m.hashed_id})`)
    wistia.mediaDelete(m.hashed_id, cb)
  })
}

// /////////////////////////////////////////////////////////////////////////////

Async.auto({
  ctx: (cb) => getContext(parseArgs(process.argv.slice(2)), cb),

  allBundles: ['ctx', (res, cb) => findBundles(res.ctx.db, cb)],

  activeBundles: ['allBundles', (res, cb) => {
    cb(null, res.allBundles.filter((b) => !b.deleted))
  }],

  deletedBundles: ['allBundles', (res, cb) => {
    cb(null, res.allBundles.filter((b) => b.deleted))
  }],

  allProjects: ['ctx', (res, cb) => fetchProjectsAndMedia(res.ctx.wistia, cb)],

  orphanedProjects: ['deletedBundles', 'allProjects', (res, cb) => {
    cb(null, getOrphanedProjects(res.deletedBundles, res.allProjects))
  }],

  orphanedMedia: ['activeBundles', 'allProjects', (res, cb) => {
    cb(null, getOrphanedMedia(res.activeBundles, res.allProjects))
  }],

  hasTasks: ['orphanedProjects', 'orphanedMedia', (res, cb) => {
    const totalTasks = res.orphanedProjects.length + res.orphanedMedia.length

    if (totalTasks === 0) {
      console.log('Nothing to do')
      process.exit()
    }

    cb(null, true)
  }],

  printSummary: ['hasTasks', (res, cb) => {
    printSummary(res.orphanedProjects, res.orphanedMedia)
    cb()
  }],

  confirmed: ['printSummary', (_, cb) => confirm(cb)],

  deleteProjects: ['ctx', 'orphanedProjects', 'confirmed', (res, cb) => {
    if (!res.confirmed) return cb()
    deleteProjects(res.ctx.wistia, res.orphanedProjects, cb)
  }],

  deleteMedia: ['ctx', 'orphanedMedia', 'confirmed', (res, cb) => {
    if (!res.confirmed) return cb()
    deleteMedia(res.ctx.wistia, res.orphanedMedia, cb)
  }]
}, (err) => {
  if (err) throw err
})
