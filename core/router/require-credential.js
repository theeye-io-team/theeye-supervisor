'use strict';

var ACL = require('../lib/acl');
var logger = require('../lib/logger')(':router:middleware:credentials');

module.exports = function (credential, options) {
  var reqLvl = ACL.accessLevel(credential);
  options||(options={});

  return function middleware (req,res,next) {
    if (!req.user) return next();

    logger.data(req.user);

    var currLvl = ACL.accessLevel(req.user.credential);
    if (options.sameLevel === true) {
      if (currLvl !== reqLevel) {
        return res.send(403,'forbidden');
      }
    } else if (currLvl < reqLvl) {
      logger.warn('user %s (%s) not allowed', (req.user.username||req.user.email), req.user.credential);
      return res.send(403,'forbidden');
    }

    return next();
  }
}

