const ACL = require('../lib/acl')

module.exports = (options) => {
  return (req, res, next) => {
    let permissions
    //
    // reduced set of permissions
    //
    if (!ACL.hasAccessLevel(req.session.credential, 'admin')) {
      // default permission granted by email
      permissions = [
        { type: 'role', value: req.session.credential },
        { type: 'principal', value: req.user.email }
      ]

      // permissions granted by tags
      const tags = req.session.member.tags
      if (tags?.length > 0) {
        for (let order = 0; order < tags.length; order++) {
          const tag = tags[order]
          if (tag.hasOwnProperty('k') && tag.hasOwnProperty('v')) {
            permissions.push({
              type: 'tag',
              value: `${tag.k}:${tag.v}`
            })
          }
        }
      }
    } else {
      permissions = true // full access
    }

    req.permissions = permissions
    next()
  }
}
