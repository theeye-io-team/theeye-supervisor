'use strict';

// order matters
const credentials = ['viewer','user','agent','manager','admin','owner','root'];

module.exports = {
  accessLevel (credential) {
    return credentials.indexOf(credential)
  },
  hasAccessLevel (current, required, options) {
    options||(options={});

    if (options.sameLevel) {
      return this.accessLevel(current) == this.accessLevel(required);
    } else {
      return this.accessLevel(current) >= this.accessLevel(required);
    }
  }
}
