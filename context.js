const Fs = require('fs')
const mongojs = require('mongojs')
const wistiajs = require('wistia-js')
const Async = require('async')
const explain = require('explain-error')

// Setup the MongoDB and Wistia client
module.exports = function getContext (argv, cb) {
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
        if (err) return cb(explain(err, 'Failed to read settings.json'))

        let wistiaApiPassword

        try {
          wistiaApiPassword = JSON.parse(settingsData).wistia.apiPassword
        } catch (err) {
          return cb(explain(err, 'Failed to parse settings.json'))
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
