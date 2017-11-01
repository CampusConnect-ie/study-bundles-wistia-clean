const Prompt = require('prompt')

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

module.exports = confirm
