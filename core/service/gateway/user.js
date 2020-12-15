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

    if (emails.length === 0) {
      throw new Error('Invalid approvers. Need at least one')
    }

    for (let index = 0; index < emails.length; index++) {
      let value = emails[index]
      if (typeof value !== 'string' || !isEmail(value)) {
        throw new Error(`Invalid email value ${value}`)
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
