'use strict'

// order matters
const credentials = ['viewer','user','agent','manager','admin','integration','owner','root']

const { ClientError, ServerError } = require('./error-handler')
const ForbiddenError = new ClientError('Forbidden', { statusCode: 403 })

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
      throw ForbiddenError
    }

    if (Array.isArray(grants)) {
      // grants are all the permissions granted to the principal
      const found = grants.find(grant => (model.acl.indexOf(grants) === -1))
      if (!found) { throw ForbiddenError }
    } else if (!email || model.acl.indexOf(email) === -1) {
      throw ForbiddenError
    }

    return
  }
}
