const got = require('got')
const qs = require('qs')
const config = require('config')
const isEmail = require('validator/lib/isEmail')
const Token = require('./token')

class GatewayMember {
  /**
   * @param {Array<String>} values can be user emails, usernames or ids
   * @param {Object} context information about inprogress request
   */
  async fetch (values, context) {
    let url = config.gateway.member.url
    url += '?' + qs.stringify({
      where: { users: values },
      gateway_token: Token.create(context)
    })

    const res = await got(url, {
      retry: { limit: 0 },
      headers: { 'content-type': 'application/json' },
      responseType: 'json'
    }).catch(err => {
      return err
    })

    return res.body
  }
}

module.exports = GatewayMember
