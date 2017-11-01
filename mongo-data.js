// Find all the bundles with wistia projects, including deleted
function findBundles (db, cb) {
  db.bundles.find({ 'wistia.project': { $exists: true } }, cb)
}

module.exports.findBundles = findBundles
