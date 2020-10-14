const ACL = require('../lib/acl')

module.exports = function (options) {
  return function (req, res, next) {
    // admins are allowed
    if (ACL.hasAccessLevel(req.user.credential, 'admin')) {
      return next()
    }

    // forbidden by default
    const model = req[options.entity.name]
    if (!model) {
      if (options.required === false) {
        return next()
      } else {
        return res.send(403, 'Forbidden')
      }
    }

    if (!model.acl || !Array.isArray(model.acl)) {
      return res.send(403, 'Forbidden')
    }

    if (model.acl.indexOf(req.user.email) === -1) {
      return res.send(403, 'Forbidden')
    }

    next()
  }
}
