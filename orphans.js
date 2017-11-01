const debug = require('debug')('wistia-clean:orphans')

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

module.exports.getOrphanedProjects = getOrphanedProjects

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

module.exports.getOrphanedMedia = getOrphanedMedia
