'use strict';

// order matters
var credentials = ['viewer','user','agent','admin','owner','root'];

module.exports = {
  accessLevel (credential) {
    var lvl ;
    lvl = credentials.indexOf(credential);
    return lvl;
  },
  hasAccessLevel (current, required) {
    return this.accessLevel(current) >= this.accessLevel(required);
  }
}
