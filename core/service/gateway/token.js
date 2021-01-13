const config = require('config')
const jwt = require('jsonwebtoken')

module.exports = {
  create (context) {
    return jwt.sign(
      { context },
      config.gateway.secret, // our Private Key
      {
        expiresIn: 60 // seconds
      }
    )
  }
}
