'use strict';

var ApiVersion = require('../lib/api-version');
var router = require('../router');

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate(['bearer','basic'],{session:false}),
    router.resolve.customerNameToEntity(),
  ];
  server.get('/',middlewares,controller.get);
}

var controller = {
  /**
   * @method GET
   */
  get (req,res,next) {
    var user = req.user;
    ApiVersion( (err,version) => {
      var message = 'TheEye - Beta ' + version.trim();
      res.send(200,message);
    });
  }
}
