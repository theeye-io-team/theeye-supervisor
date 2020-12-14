const got = require('got')
const qs = require('qs')
const config = require('config')
const isEmail = require('validator/lib/isEmail')

class GatewayUser {
  /**
   * @param {Array<String>} emails
   */
  async emailToObjectID (emails) {
    if (!Array.isArray(emails)) {
      throw new Error('Invalid data format. Array required')
    }

    for (let value of emails) {
      if (!isEmail(value)) {
        throw new Error('Invalid email value')
      }
    }

    let url = config.gateway.user.url
    url += '?' + qs.stringify({
      secret: config.gateway.secret,
      where: {
        email: { $in: emails }
      },
      include: { email: 1 }
    })

    const res = await got(url, {
      headers: { 'content-type': 'application/json' },
      responseType: 'json'
    })

    const users = res.body

    return users.map(user => user.id)
  }
}

module.exports = GatewayUser
