const ACL = require('../lib/acl')
const { ForbiddenError } = require('../lib/error-handler')

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

      const toCheck = {
        permissions: req.permissions,
        model,
        //email: req.user.email,
        //grants: req.session.member.tags,
        credential: req.session.credential
      }

      ACL.ensureAllowed(toCheck)
      next()
    } catch (err) {
      return res.sendError(err)
    }
  }
}
