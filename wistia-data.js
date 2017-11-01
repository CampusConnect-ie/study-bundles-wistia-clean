'use strict'

const Async = require('async')
const debug = require('debug')('wistia-clean:wistia-data')
const explain = require('explain-error')

const CONCURRENCY = 5
const PER_PAGE = 100

// Fetch all the Wistia projects
function fetchProjects (wistiaClient, cb) {
  let allProjects = []
  let page = 1
  let hasMore = true

  const iteratee = (cb) => {
    debug(`Getting projects page ${page}`)

    wistiaClient.projectList({ page, per_page: PER_PAGE }, (err, data) => {
      if (err) return cb(explain(err, `Failed to get projects page ${page}`))

      const projects = JSON.parse(data)
      debug(`Found ${projects.length} in page ${page}`)

      allProjects = allProjects.concat(projects)
      hasMore = projects.length >= PER_PAGE
      page++

      cb()
    })
  }

  Async.doWhilst(iteratee, () => hasMore, (err) => {
    if (err) return cb(explain(err, 'Failed to fetch all projects'))
    cb(null, allProjects)
  })
}

module.exports.fetchProjects = fetchProjects

// Fetch all the media in a given project
function fetchMedia (wistiaClient, projectId, cb) {
  let allMedia = []
  let page = 1
  let hasMore = true

  const iteratee = (cb) => {
    debug(`Getting media page ${page} of project ${projectId}`)

    wistiaClient.mediaList(projectId, page, PER_PAGE, (err, data) => {
      if (err) return cb(explain(err, `Failed to get media page ${page}`))

      const media = JSON.parse(data)
      debug(`Found ${media.length} in page ${page} of project ${projectId}`)

      allMedia = allMedia.concat(media)
      hasMore = media.length >= PER_PAGE
      page++

      cb()
    })
  }

  Async.doWhilst(iteratee, () => hasMore, (err) => {
    if (err) return cb(explain(err, `Failed to fetch all media for project ${projectId}`))
    cb(null, allMedia)
  })
}

module.exports.fetchMedia = fetchMedia

// Fetch all the projects, and all the media in each project
function fetchProjectsAndMedia (wistiaClient, cb) {
  fetchProjects(wistiaClient, (err, projects) => {
    if (err) return cb(err)

    Async.mapLimit(projects, CONCURRENCY, (project, cb) => {
      fetchMedia(wistiaClient, project.id, (err, media) => {
        if (err) return cb(err)
        project.media = media
        cb(null, project)
      })
    }, cb)
  })
}

module.exports.fetchProjectsAndMedia = fetchProjectsAndMedia

function deleteProjects (wistiaClient, projects, cb) {
  Async.eachLimit(projects, CONCURRENCY, (p, cb) => {
    debug(`Deleting project ${p.id} (${p.hashedId})`)
    wistiaClient.projectDelete(p.hashedId, (err) => {
      if (err) return cb(explain(err, `Failed to delete project ${p.hashedId}`))
      cb()
    })
  }, cb)
}

module.exports.deleteProjects = deleteProjects

function deleteMedia (wistiaClient, media, cb) {
  Async.eachLimit(media, CONCURRENCY, (m, cb) => {
    debug(`Deleting media ${m.id} (${m.hashed_id})`)
    wistiaClient.mediaDelete(m.hashed_id, (err) => {
      if (err) return cb(explain(err, `Failed to delete media ${m.hashed_id}`))
      cb()
    })
  }, cb)
}

module.exports.deleteMedia = deleteMedia
