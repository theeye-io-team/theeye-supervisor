const config = require('config')
const jwt = require('jsonwebtoken')
const fs = require('fs')

module.exports = {
  create (context) {
    const authCfg = config.authentication

    // seconds
    const signSettings = { expiresIn: authCfg?.expiresIn || 10 }

    let key
    if (authCfg.rs256?.priv) {
      key = fs.readFileSync(authCfg.rs256.priv, 'utf8')
      signSettings.algorithm = "RS256"
    } else {
      key = authCfg.secret
      signSettings.algorithm = "HS256"
    }

    if (!key) {
      throw new Error('Authorization system: security key not set')
    }

    return jwt.sign({ context }, key, signSettings)
  }
}
