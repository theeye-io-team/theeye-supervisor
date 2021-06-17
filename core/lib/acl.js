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
  ensureAllowed ({ email, credential, model }) {
    // admins are allowed
    if (this.hasAccessLevel(credential, 'admin')) {
      return
    }

    if (!model.acl || !Array.isArray(model.acl) || model.acl.length === 0) {
      throw ForbiddenError
    }

    if (model.acl.indexOf(email) === -1) {
      throw ForbiddenError
    }

    return
  }
}
