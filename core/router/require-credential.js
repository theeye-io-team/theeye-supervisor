'use strict';

var ACL = require('../lib/acl');
var logger = require('../lib/logger')(':router:middleware:credentials');

/**
 *
 * @param {Object} options
 *  options.exactLevel , must match the same exact credential
 *
 */
module.exports = function (credential, options) {
  var reqLvl = ACL.accessLevel(credential);
  options||(options={});

  return function middleware (req,res,next) {
    if (!req.user) return next();

    var currLvl = ACL.accessLevel(req.user.credential);
    if (options.exactMatch === true) {
      if (currLvl !== reqLvl) {
        return res.send(403,'forbidden');
      }
    } else if (currLvl < reqLvl) {
      logger.warn('user %s (%s) not allowed', (req.user.username||req.user.email), req.user.credential);
      return res.send(403,'forbidden');
    }

    return next();
  }
}

