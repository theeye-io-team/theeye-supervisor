const got = require('got')
const qs = require('qs')
const config = require('config')
const Token = require('./token')

class GatewayAccessControl {
  /**
   * @param {Array<String>} values can be email or username
   * @param {Object} context information about inprogress request
   * @return {Promise}
   */
  authorize (req, action, attrs) {
    const url = config.gateway.authorize.url + '?access_token=' + req.token

    const request = got.post(url, {
      retry: { limit: 0 },
      json: { action, attrs },
      headers: {
        'content-type': 'application/json'
      },
      responseType: 'json'
    })

    return request
      .then(res => res.body)
      .catch(err => {
        // notify us
        if (!err.response) { throw err }
        throw err
      })
  }
}

module.exports = GatewayAccessControl

