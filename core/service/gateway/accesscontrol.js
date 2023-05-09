const got = require('got')
const qs = require('qs')
const config = require('config')
const Token = require('./token')

class GatewayAccessControl {
  /**
   * @param {Array<String>} values can be email or username
   * @param {Object} context information about inprogress request
   */
  authorize (userId, action, attrs) {
    const url = config.gateway.authorize.url + '?gateway_token=' + Token.create({})

    return got.post(url, {
      retry: { limit: 0 },
      headers: {
        'content-type': 'application/json'
      },
      responseType: 'json'
    })
      .then(res => res.body)
      .catch(err => {
        // notify us
        if (!err.response) { throw err }

        //if (
        //  err.response.statusCode >= 400 &&
        //  err.response.statusCode < 500
        //) {
        //} 

        throw err
      })
  }
}

module.exports = GatewayAccessControl

