"use strict";

var debug = require('../lib/logger')('eye:supervisor:controller:task');
var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
// var Task = require(process.env.BASE_PATH + '/entity/task').Entity;
var TaskService = require(process.env.BASE_PATH + '/service/task');
// var Script = require(process.env.BASE_PATH + '/entity/script').Entity;
// var Host = require(process.env.BASE_PATH + '/entity/host').Entity;
var resolver = require('../router/param-resolver');
var filter = require('../router/param-filter');

var Scheduler = require('../lib/scheduler').getInstance();

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
    resolver.idToEntity({param:'task'}),
    resolver.idToEntity({param:'host'}),
    resolver.idToEntity({param:'script'})
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
};


var controller = {
  /**
   *
   * @method POST
   * @author Facugon
   *
   */
  create (req, res, next) {
    var input = {
      'customer': req.customer,
      'user': req.user,
      'script': req.script,
      'name': req.body.name,
      'description': req.body.description,
      'script_runas': req.body.script_runas,
      'public': filter.toBoolean(req.body.public),
      'hosts': filter.toArray(req.body.hosts),
      'tags': filter.toArray(req.body.tags),
      'script_arguments': filter.toArray(req.body.script_arguments)
    };

    if(!input.script) return res.send(400, json.error('script is required'));
    if(!input.customer) return res.send(400, json.error('customer is required'));
    if(input.hosts.length===0) return res.send(400, json.error('a host is required'));
    if(!input.name) return res.send(400, json.error('name is required'));

    TaskService.createManyTasks(input, function(error, tasks) {
      if(error) return res.send(500, error);
      res.send(200, { tasks: tasks });
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
      res.send(200, { tasks: tasks });
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

    task.publish(function(published) {
      res.send(200, { task: published});
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
    var task = req.task;
    var input = {};

    if(!task) return res.send(404);

    if(req.host) input.host_id = req.host._id;
    if(req.script) input.script_id = req.script._id;
    if(req.body.public) input.public = filter.toBoolean(req.body.public);
    if(req.body.description) input.description = req.body.description;
    if(req.body.name) input.name = req.body.name;
    if(req.body.script_runas) input.script_runas = req.body.script_runas;
    if(req.body.tags) input.tags = filter.toArray(req.body.tags);

    var scriptArgs = filter.toArray(req.body.script_arguments);
    if( scriptArgs.length > 0 ) input.script_arguments = scriptArgs;

    debug.log('updating task %j', input);
    TaskService.update({
      user:req.user,
      customer:req.customer,
      task:task,
      updates:input,
      done:function(task){
        res.send(200,{task:task});
      },
      fail:function(error){
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
