const got = require('got')
const qs = require('qs')
const config = require('config')
const Token = require('./token')
const { ClientError, ServerError } = require('../../lib/error-handler')

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

  async fromUsers (users, customer) {
    const members = await this.fetch(users, { customer_id: customer.id })
    if (!members || members.length === 0) {
      throw new ClientError(`Invalid members. ${JSON.stringify(users)}`)
    }

    if (users.length !== members.length) {
      const invalid = []
      for (let user of users) {
        const elem = members.find(member => {
          return member.user.username === user || member.user.email === user
        })

        if (!elem) {
          invalid.push(user)
        }
      }

      if (invalid.length > 0) {
        throw new ClientError(`Invalid members. ${JSON.stringify(invalid)}`)
      }
    }

    return members
  }
}

module.exports = GatewayMember
