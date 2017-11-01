const explain = require('explain-error')

// Find all the bundles with wistia projects, including deleted
function findBundles (db, cb) {
  db.bundles.find({ 'wistia.project': { $exists: true } }, (err, bundles) => {
    if (err) return cb(explain(err, 'Failed to find bundles'))
    cb(null, bundles)
  })
}

module.exports.findBundles = findBundles
