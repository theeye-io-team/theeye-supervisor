"use strict";

var router = require('../router');
var resolve = router.resolve;
var async = require('async');
var Event = require('../entity/event').Event;
var Workflow = require('../lib/workflow');

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
    var customer = req.customer;
    var node = req.params.node;

    Event.fetch({ customer: req.customer },(err,events) => {
      if(err) res.send(500);

      var workflow = new Workflow();
      workflow.fromEvents(events);

      if( ! node ) {
        return res.send( 200, workflow.graph );
      } else {
        return res.send( 200, workflow.getPath(node) );
      }

    })
  },
}
