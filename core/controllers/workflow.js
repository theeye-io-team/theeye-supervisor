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
    router.ensureCustomer, // requesting user is authorized to access the customer
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

    Event.fetch({ customer: req.customer._id },(err,events) => {
      if(err) res.send(500);
      if(!events||events.length==0){
        return res.send(500,'workflow unavailable');
      }

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
