const ACL = require('../lib/acl')
const { ForbiddenError, ServerError } = require('../lib/error-handler')
const ensurePermissions = require('./ensure-permissions')

module.exports = function (options) {
  return (req, res, next) => {
    try {
      // forbidden by default
      const model = req[options.entity.name]
      if (!model) {
        if (options.required === false) {
          return next()
        } else {
          throw new ForbiddenError()
        }
      }

      new Promise((resolve, reject) => {
        if (!req.hasOwnProperty('permissions')) {
          ensurePermissions()(req, res, err => {
            if (err) { return reject(err) }
            else { return resolve() }
          })
        }
      }).then(() => {
        const toCheck = {
          permissions: req.permissions,
          model,
          //email: req.user.email,
          //grants: req.session.member.tags,
          credential: req.session.credential
        }

        ACL.ensureAllowed(toCheck)
        return next()
      })
    } catch (err) {
      return res.sendError(err)
    }
  }
}
