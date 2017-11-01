const parseArgs = require('minimist')
const Async = require('async')
const getContext = require('./context')
const MongoData = require('./mongo-data')
const WistiaData = require('./wistia-data')
const Orphans = require('./orphans')
const confirm = require('./confirm')
const printSummary = require('./summary')

Async.auto({
  ctx: (cb) => getContext(parseArgs(process.argv.slice(2)), cb),

  allBundles: ['ctx', (res, cb) => MongoData.findBundles(res.ctx.db, cb)],

  activeBundles: ['allBundles', (res, cb) => {
    cb(null, res.allBundles.filter((b) => !b.deleted))
  }],

  deletedBundles: ['allBundles', (res, cb) => {
    cb(null, res.allBundles.filter((b) => b.deleted))
  }],

  allProjects: ['ctx', (res, cb) => {
    WistiaData.fetchProjectsAndMedia(res.ctx.wistia, cb)
  }],

  orphanedProjects: ['deletedBundles', 'allProjects', (res, cb) => {
    cb(null, Orphans.getOrphanedProjects(res.deletedBundles, res.allProjects))
  }],

  orphanedMedia: ['activeBundles', 'allProjects', (res, cb) => {
    cb(null, Orphans.getOrphanedMedia(res.activeBundles, res.allProjects))
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
    WistiaData.deleteProjects(res.ctx.wistia, res.orphanedProjects, cb)
  }],

  deleteMedia: ['ctx', 'orphanedMedia', 'confirmed', (res, cb) => {
    if (!res.confirmed) return cb()
    WistiaData.deleteMedia(res.ctx.wistia, res.orphanedMedia, cb)
  }]
}, (err) => {
  if (err) throw err
})
