"use strict";

var router = require('../router');
var resolve = router.resolve;

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session:false }),
    resolve.customerNameToEntity({ required:true }),
    router.userCustomer, // requesting user is authorized to access the customer
  ];

  server.get(
    '/:customer/workflow',
    middlewares,
    controller.fetch
  );
}

var controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    // node could be a task , monitor , webhook or an event
    var node = req.params.node;
  },
}
