"use strict";

const App = require('../app');
const logger = require('../lib/logger')('controller:task-schedule');
const router = require('../router');
const resolver = router.resolve;

const JobConstants = require('../constants/jobs')

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('admin'),
    resolver.customerNameToEntity({required:true}),
    router.ensureCustomer,
    resolver.idToEntity({param:'task'})
  ]

  //server.post('/:customer/task/:task/schedule',middlewares,controller.create);
  server.post('/:customer/task/:task/schedule',middlewares,controller.create)
  server.get('/:customer/task/:task/schedule',middlewares,controller.fetch)
  server.del('/:customer/task/:task/schedule/:schedule',middlewares,controller.remove)

  // this is for the email cancelation
  // authenticate with a secret token
  // only valid for this action
  server.get('/:customer/task/:task/schedule/:schedule/secret/:secret',[
    resolver.idToEntity({param:'task',required:true}),
    router.requireSecret('task'),
    resolver.customerNameToEntity({required:true}),
  ], controller.remove)
}

const controller = {
  /**
   * Gets schedule data for a task
   * @author cg
   * @method GET
   * @route /:customer/task/:task/schedule
   * @param {String} :task , mongo ObjectId
   *
   */
  fetch (req, res, next) {
    var task = req.task;
    App.scheduler.getTaskSchedule(task._id, function (err, scheduleData) {
      if (err) {
        logger.error('Scheduler had an error retrieving data for %s',task._id)
        logger.error(err)
        return res.send(500)
      }
      else res.send(200, scheduleData)
    })
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
    if (!scheduleId) res.send(400,'schedule id required');

    App.scheduler.cancelTaskSchedule(task, scheduleId, function (err, qtyRemoved) {
      if (err) {
        logger.error('Scheduler had an error canceling schedule %s',scheduleId);
        logger.error(err);
        return res.send(500);
      }
      else res.send(200,{})
    })
  },
  /**
   *
   * @author cg
   * @method POST
   * @route /:customer/task/:task/schedule
   *
   */
  create (req, res, next) {
    var task = req.task
    var user = req.user
    var customer = req.customer

    if (!req.body.scheduleData||!req.body.scheduleData.runDate) {
      return res.send(400,json.error('Must have a date'))
    }

    App.scheduler.scheduleTask({
      origin: JobConstants.ORIGIN_SCHEDULER,
      task: task,
      customer: customer,
      user: user,
      schedule: req.body.scheduleData
    }, function (err, schedule) {
      if (err) {
        logger.error(err)
        return res.send(500, err)
      }
      res.send(200, schedule)
    })
  }
}
