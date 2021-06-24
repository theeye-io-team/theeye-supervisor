const got = require('got')
const qs = require('qs')
const config = require('config')
const isEmail = require('validator/lib/isEmail')
const Token = require('./token')

class GatewayUser {
  /**
   * @param {Array<String>} values can be email or username
   * @param {Object} context information about inprogress request
   */
  fetch (values, context) {
    let url = config.gateway.user.url
    url += '?' + qs.stringify({
      where: { users: values },
      gateway_token: Token.create(context)
    })

    return got(url, {
      retry: { limit: 0 },
      headers: { 'content-type': 'application/json' },
      responseType: 'json'
    })
      .then(res => res.body)
      .catch(err => {
        // notify us
        if (!err.response) {
          throw err
        }
        if (err.response.statusCode >= 400 && err.response.statusCode < 500) {
          return []
        } 
        throw err
      })
  }
}

module.exports = GatewayUser
