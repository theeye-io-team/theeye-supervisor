'use strict';

var credentials = ['viewer','user','agent','admin','owner','root'];

module.exports = {
  accessLevel (credential) {
    var lvl ;
    lvl = credentials.indexOf(credential);
    return lvl;
  }
}
