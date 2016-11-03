"use strict";

var logger = require('../lib/logger')('eye:supervisor:controller:schedule');
var Scheduler = require('../service/scheduler');

var router = require('../router');
var resolver = router.resolve;

module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    router.userCustomer
  ];

  server.get('/:customer/schedule', middlewares, controller.getCustomerSchedules);

};

var controller = {
  /**
   * Gets schedules for user. This means a list of all scheduled "things" (tasks?)
   * @author cg
   * @method GET
   * @route /:customer/task/
   */
  getCustomerSchedules (req, res, next) {
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
