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
    // resolver.idToEntity({param:'schedule'})
  ];

  // server.post('/:customer/schedule',middlewares,controller.create);
  // server.get('/:customer/schedule/:schedule',middlewares, controller.get);
  // server.del('/:customer/schedule/:schedule',middlewares, controller.remove);
  server.get('/:customer/schedule', middlewares, controller.getCustomerSchedules);

};

var controller = {
  /**
   * Gets schedule data for a task
   * @author cg
   * @method GET
   * @route /:customer/task/:task/schedule
   * @param {String} :task , mongo ObjectId
   *
   */
  get (req, res, next) {
    var task = req.task;
    if(!task) return res.send(404,'task not found');
    Scheduler.getTaskScheduleData(task._id, function(err, scheduleData){
      if(err) {
        logger.error('Scheduler had an error retrieving data for %s',task._id);
        logger.error(err);
        return res.send(500);
      }
      else res.send(200, { scheduleData: scheduleData });
    });
  },
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
  },
  /**
   *
   * @method DELETE
   * @route /:customer/task/:task/schedule/:schedule
   *
   */
  remove (req, res, next) {
    var task = req.task;
    var scheduleId = req.params.schedule;
    if(!req.params.task) return res.send(400,'task id required');
    if(!task) return res.send(404,'task not found');
    if(!scheduleId) res.send(400,'schedule id required');

    Scheduler.cancelTaskSchedule(task.id, scheduleId, function(err, qtyRemoved){
      if(err) {
        logger.error('Scheduler had an error canceling schedule %s',scheduleId);
        logger.error(err);
        return res.send(500);
      }
      else res.send(200,{status:'done'});
    });
  },
  /**
   *
   * @author cg
   * @method POST
   * @route /:customer/task/schedule
   *
   */
  create (req, res, next){
    var task = req.task;
    var schedule = req.body.scheduleData;

    if(!task) return res.send(400,json.error('task required'));

    if(!schedule || !schedule.runDate) {
      return res.send(406,json.error('Must have a date'));
    }
    var user = req.user ;
    var customer = req.customer ;

    if(!user) return res.send(400,json.error('user required'));
    if(!customer) return res.send(400,json.error('customer required'));

    Scheduler.scheduleTask({
      task: task,
      customer: customer,
      user: user,
      schedule: schedule
    }, function(err) {
      if(err) {
        logger.error(err);
        return res.send(500, err);
      }

      res.send(200, {nextRun : schedule.runDate});
    });
  }
};
