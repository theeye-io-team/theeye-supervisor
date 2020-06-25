const CustomerConstants = require('../constants/customer')
const passport = require('passport')

module.exports = function (server) {
  /**
   * DEPRECATED
   * backward compatibility
   * agents basic authentication
   */
  server.post(
    '/token',
    (req, res, next) => {
      passport.authenticate('basic', (err, token) => {
        if (err) {
          res.send(err.statusCode, err.message)
        } else {
          res.send(200, token)
        }
      }, {session:false})(req, res, next)
    }
  )
}
