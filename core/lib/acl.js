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
  ensureAllowed ({ email, grants, credential, model }) {
    // admins are allowed
    if (this.hasAccessLevel(credential, 'admin')) {
      return
    }

    if (!model.acl || !Array.isArray(model.acl) || model.acl.length === 0) {
      throw new ForbiddenError()
    }

    // grants are all the permissions granted to the principal
    if (Array.isArray(grants)) {
      let found
      for (let order = 0; order < grants.length && !found; order++) {
        let grant = grants[order]
        // remap. convert to string
        if (grant.hasOwnProperty('k') && grant.hasOwnProperty('v')) {
          grant = `${grant.k}:${grant.v}`
        } else if (typeof grant !== 'string') {
          grant = grant.toString()
        }

        found = (model.acl.indexOf(grant) === -1)
      }
      if (!found) {
        throw new ForbiddenError()
      }
    } else if (!email || model.acl.indexOf(email) === -1) {
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
