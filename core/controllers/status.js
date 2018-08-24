const App = require('../app')
const router = require('../router')
const merge = require('lodash/merge')
const config = require('config')
const crypto = require('crypto')


module.exports = (server, passport) => {

  server.get(
    '/status',
    [
    ],
    controller.status
  )

}

const controller = {
  status (req, res, next) {
    res.send(200, { message: 'Hi, I am ok. Thanks for asking' })
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
