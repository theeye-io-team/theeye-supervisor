'use strict';

// order matters
var credentials = ['viewer','user','agent','admin','owner','root'];

module.exports = {
  accessLevel (credential) {
    var lvl ;
    lvl = credentials.indexOf(credential);
    return lvl;
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
