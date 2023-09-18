const ACL = require('../lib/acl')

module.exports = () => {
  return (req, res, next) => {
    //
    // prepare set of permissions
    //

    //if (req.hasOwnProperty('permissions')) {
    //}

    if (!ACL.hasAccessLevel(req.session.credential, 'admin')) {
      req.permissions = ACL.buildPermissions({
        role: req.session.credential,
        identifier: req.user.email,
        tags: req.session.member.tags
      })
    } else {
      req.permissions = true // full access
    }
    next()
  }
}
