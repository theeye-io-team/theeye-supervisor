
const ACL = require('../lib/acl')
const logger = require('../lib/logger')(':router:middleware:credentials')

/**
 *
 * @param {Object} options
 * @property {Boolean} options.exactMatch must match the same exact credential
 *
 */
module.exports = function (credential, options) {
  const reqLvl = ACL.accessLevel(credential)
  options || (options={})

  return function middleware (req, res, next) {
    if (!req.session) {
      return res.send(403,'forbidden')
    }

    const currLvl = ACL.accessLevel(req.session.credential)
    if (options.exactMatch === true) {
      if (currLvl !== reqLvl) {
        return res.send(403,'forbidden')
      }
    } else if (currLvl < reqLvl) {
      logger.warn('user %s (%s) not allowed', (req.user?.username||req.user?.email), req.session.credential)
      return res.send(403,'forbidden')
    }

    return next()
  }
}
