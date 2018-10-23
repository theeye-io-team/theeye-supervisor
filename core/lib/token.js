const crypto = require('crypto')

const SIZE = 20

module.exports = {
  randomToken (size) {
    size || (size=SIZE)
    return crypto.randomBytes(size).toString('hex')
  }
}
