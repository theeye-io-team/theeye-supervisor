"use strict";

var logger = require('../lib/logger')('eye:supervisor:controller:schedule');
var Scheduler = require('../service/scheduler');
var router = require('../router');

module.exports = function(server){
  var middlewares = [
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ];

  server.get('/:customer/schedule',middlewares,controller.fetch);
};

var controller = {
  /**
   * @author cg
   * @method GET
   * @route /:customer/schedule
   */
  fetch (req, res, next) {
    Scheduler.getSchedules(req.customer._id, function(err, schedules){
      if(err) {
        logger.error('Scheduler got an error retrieving data for customer %s',req.customer._id);
        logger.error(err);
        return res.send(500);
      }
      else res.send(200, schedules);
    });
  }
};
