// order matters
const credentials = ['viewer','user','agent','manager','admin','integration','owner','root']

const { ClientError, ServerError, ForbiddenError } = require('./error-handler')

module.exports = {
  accessLevel (credential) {
    return credentials.indexOf(credential)
  },
  hasAccessLevel (current, required, options) {
    options||(options={})

    if (options.sameLevel) {
      return this.accessLevel(current) == this.accessLevel(required)
    } else {
      return this.accessLevel(current) >= this.accessLevel(required)
    }
  },
  buildPermissions ({ tags, role, identifier }) {
    // default permission granted by email
    const permissions = [
      { type: 'role', value: role },
      { type: 'principal', value: identifier }
    ]

    // permissions granted by tags
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

    return permissions
  },
  ensureAllowed ({ permissions, credential, model }) {
    // admins are allowed
    if (this.hasAccessLevel(credential, 'admin')) {
      return
    }

    if (
      !model.acl ||
      !Array.isArray(model.acl) ||
      model.acl.length === 0
    ) {
      throw new ForbiddenError()
    }

    // grants are all the permissions granted to the principal
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new ForbiddenError()
    }

    let found
    for (let order = 0; order < permissions.length && !found; order++) {
      const perm = permissions[order]
      found = (model.acl.indexOf(perm?.value) === -1)
    }

    if (!found) {
      throw new ForbiddenError()
    }

    return
  },
  isAllowed (input) {
    try {
      this.ensureAllowed(input)
      return true
    } catch (err) {
      return false
    }
  }
}
