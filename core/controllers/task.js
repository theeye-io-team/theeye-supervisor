"use strict";

var debug = require('../lib/logger')('eye:supervisor:controller:task');
var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
// var Task = require(process.env.BASE_PATH + '/entity/task').Entity;
var TaskService = require(process.env.BASE_PATH + '/service/task');
// var Script = require(process.env.BASE_PATH + '/entity/script').Entity;
// var Host = require(process.env.BASE_PATH + '/entity/host').Entity;
var resolver = require('../router/param-resolver');
var filter = require('../router/param-filter');
var extend = require('lodash/assign');

var Scheduler = require('../lib/scheduler');

module.exports = function(server, passport){
  server.get('/:customer/task/:task',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'})
  ],controller.get);

  server.get('/:customer/task/:task/schedule',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'})
  ], controller.getSchedule);

  server.get('/:customer/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'host'})
  ], controller.fetch);

  server.patch('/:customer/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'task'})
  ],controller.patch);

  server.post('/:customer/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'script'})
  ],controller.create);

  server.post('/:customer/task/schedule',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'task'})
  ],controller.schedule);

  server.del('/:customer/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'task'})
  ],controller.remove);

  server.del('/:customer/task/:task/schedule/:schedule',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'task'})
  ], controller.cancelSchedule);
};


var controller = {
  /**
   *
   * @method POST
   * @author Facugon
   *
   */
  create (req, res, next) {
    var input = extend({},req.body,{
      'customer': req.customer,
      'user': req.user,
      'script': req.script
    });

    if(!input.type) return res.send(400, json.error('type is required'));
    if(!input.customer) return res.send(400, json.error('customer is required'));
    if(!input.hosts) return res.send(400, json.error('a host is required'));
    if(Array.isArray(input.hosts)){
      if(input.hosts.length===0){
        return res.send(400, json.error('a host is required'));
      }
    } else {
      input.hosts = [ input.hosts ];
    }
    if(!input.name) return res.send(400, json.error('name is required'));
    if(input.type=='script'){
      if(!input.script) return res.send(400, json.error('script is required'));
    } else if(input.type=='scraper'){
    }

    TaskService.createManyTasks(input, function(error, tasks) {
      if(error) {
        debug.error(error);
        return res.send(500, error);
      }
      res.send(200, tasks);
      next();
    });
  },
  /**
   * @author Facundo
   * @method GET
   * @route /task
   */
  fetch (req, res, next) {
    var host = req.host;
    var customer = req.customer;

    var input = {};
    if(customer) input.customer_id = customer._id;
    if(host) input.host_id = host._id;

    debug.log('fetching tasks');
    TaskService.fetchBy(input, function(error, tasks) {
      if(error) return res.send(500);
      res.send(200, tasks);
    });
  },
  /**
   *
   * @author Facundo
   * @method GET
   * @route /task/:task
   * @param {String} :task , mongo ObjectId
   *
   */
  get (req, res, next) {
    var task = req.task;
    if(!task) return res.send(404);

    task.publish(function(data) {
      res.send(200, data);
    });
  },
  /**
   * Gets schedule data for a task
   * @author cg
   * @method GET
   * @route /task/:task/schedule
   * @param {String} :task , mongo ObjectId
   *
   */
  getSchedule (req, res, next) {
    var task = req.task;
    if(!task) return res.send(404);
    Scheduler.getTaskScheduleData(task._id, function(err, scheduleData){
      if(err) {
        console.log(' ------ Scheduler had an error retrieving data for',task._id);
        console.log(err);
        res.send(500);
      }
      res.send(200, { scheduleData: scheduleData });
    });
  },
  cancelSchedule (req, res, next) {
    var taskId = req.params.task;
    var scheduleId = req.params.schedule;
    if(!taskId || !scheduleId) {
      res.send(500, 'Parameter missing');
    }

    Scheduler.cancelTaskSchedule(taskId, scheduleId, function(err, qtyRemoved){
      if(err) {
        console.log(' ------ Scheduler had an error canceling schedule', scheduleId);
        console.log(err);
        res.send(500, 'Error canceling schedule');
      }
      res.send(200,{status:'done'});
    });
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   * @route /task/:task
   * @param {String} :task , mongo ObjectId
   *
   */
  remove (req,res,next) {
    var task = req.task;
    if(!task) return res.send(404);

    TaskService.remove({
      task:task,
      user:req.user,
      customer:req.customer,
      done:function(){
        res.send(204);
      },
      fail:function(error){
        res.send(500);
      }
    });
  },
  /**
   *
   * @author Facundo
   * @method PATCH
   * @route /task/:task
   * @param {String} :task , mongo ObjectId
   * @param ...
   *
   */

  patch (req, res, next) {
    if(!req.task) return res.send(404);
    var input = extend({},req.body);

    debug.log('updating task %j', input);
    TaskService.update({
      user: req.user,
      customer: req.customer,
      task: req.task,
      updates: input,
      done: function(task){
        res.send(200,task);
      },
      fail: function(error){
        debug.error(error);
        res.send(500);
      }
    });
  },
  /**
   *
   * @author cg
   * @method POST
   * @route /task/:task
   *
   */
  schedule(req, res, next){
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

    var jobData = {
      // task: task,
      // user: user,
      // customer: customer,
      // notify: true
    };
    jobData.task_id = task._id ;
    jobData.host_id = task.host_id ;
    jobData.script_id = task.script_id ;
    jobData.script_arguments = task.script_arguments ;
    jobData.user_id = user._id;
    jobData.name = task.name ;
    jobData.customer_id = customer._id;
    jobData.customer_name = customer.name;
    jobData.state = 'new' ;
    jobData.notify = true ;
    jobData.scheduleData = schedule;

    Scheduler.scheduleTask(jobData, function(err){
      if(err) {
        console.log(err);
        console.log(arguments);
        res.send(500, err);
      }
      res.send(200, {nextRun : schedule.runDate});
    });


  }
};
