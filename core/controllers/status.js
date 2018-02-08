const App = require('../app')
const router = require('../router')
const merge = require('lodash/merge')
const config = require('config')
const crypto = require('crypto')


module.exports = (server, passport) => {

  server.get(
    '/status/config',
    [
      passport.authenticate('bearer', { session:false }),
      router.requireCredential('root')
    ],
    controller.config
  )

}

const controller = {
  config (req, res, next) {
    let secret = req.user.client_secret
    let data = merge({}, config, {
      mongo: `Encoded ${encodeObject(secret, config.mongo)}`,
      aws: `Encoded ${encodeObject(secret, config.aws)}`
    })
    res.send(200, data)
    next()
  }
}

/**
 * @param {String} secret
 * @param {String} data
 * @return {String}
 */
const encodeObject = (secret, data) => {
  return crypto
    .createHmac('sha256', secret)
    .update( JSON.stringify(data) )
    .digest('hex')
}
