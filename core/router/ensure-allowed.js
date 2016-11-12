'use strict';

var ACL = require('../lib/acl');

module.exports = function (options) {

  return function (req,res,next) {
    // admins are allowed
    if (ACL.hasAccessLevel(req.user.credential,'admin')) {
      return next();
    }

    // forbidden by default
    var model = req[options.entity.name];
    if (!model.acl||!Array.isArray(model.acl)) {
      return res.send(403,'forbidden');
    }

    if (model.acl.indexOf(req.user.email) === -1) {
      return res.send(403,'forbidden');
    }

    next();
  }
};
