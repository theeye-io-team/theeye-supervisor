'use strict'

const moment = require('moment')
const crypto = require('crypto')

module.exports = {
  create (client_id, client_secret, next) {
    let timestamp = moment().format('YYYY-MM-DD HH:00:00')
    let key = (client_id + client_secret + timestamp)
    let token = crypto
      .createHmac('sha256', key)
      .update(client_secret)
      .digest('hex')

    if (!token) {
      next(new Error("Can't create token"))
    }
    else next(null, { token: token, timestamp: timestamp })
  }
}
