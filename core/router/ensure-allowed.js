'use strict';

var ACL = require('../lib/acl');

module.exports = function (options) {
  return function (req,res,next) {
    var credential = req.user.credential;

    if (credential==='admin') return next();

    next();
  }
};
