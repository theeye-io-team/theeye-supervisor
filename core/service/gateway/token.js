const config = require('config')
const jwt = require('jsonwebtoken')

module.exports = {
  create (context) {
    const key = config.authentication.rs256.priv
    return jwt.sign(
      { context },
      key, // our Private Key
      {
        expiresIn: 60, // seconds
        algorithm: "RS256"
      }
    )
  }
}
