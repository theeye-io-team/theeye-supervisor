"use strict";

var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var Job = require(process.env.BASE_PATH + "/entity/job").Entity;
var JobService = require(process.env.BASE_PATH + "/service/job");
var Task = require(process.env.BASE_PATH + "/entity/task").Entity;
var debug = require('../lib/logger')('eye:supervisor:controller:job');
var paramsResolver = require('../router/param-resolver');
var Scheduler = require('../lib/scheduler');

module.exports = function(server, passport) {
  server.get('/:customer/job/:job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.idToEntity({param:'job'})
  ],controller.get);

  server.put('/:customer/job/:job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.idToEntity({param:'job'})
  ],controller.update);

  server.get('/:customer/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ], controller.fetch);

  server.post('/:customer/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'task'}),
    paramsResolver.customerNameToEntity({})
  ],controller.create);

  server.post('/:customer/job/schedule',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({})
  ],controller.schedule);
};

var controller = {
  get(req,res,next) {
    var job = req.job;
    if(!job) return res.send(404,json.error('not found'));
    res.send(200,{ job: job });
  },
  fetch(req,res,next) {
    debug.log('querying jobs');
    if(!req.customer) return res.send(400,json.error('customer is required'));
    if(!req.host) return res.send(400,json.error('host is required'));
    var host = req.host;
    var customer = req.customer;

    var input = { host: req.host };

    if( req.params.process_next ) {
      JobService.getNextPendingJob(input,function(error,job){
        var jobs = [];
        if( job != null ) jobs.push(job);
        res.send(200, { jobs : jobs });
      });
    } else {
      Job.find({
        host_id:host.id,
        customer_name:customer.name
      }).exec(function(err,jobs){
        res.send(200, { jobs : jobs });
      });
    }
  },
  update (req, res, next) {
    var job = req.job;
    var input = req.params.result ;
    if(!job) return res.send(404, json.error('not found'));
    if(!input) return res.send(400, json.error('result data is required'));

    JobService.updateResult(job,input,error=>{
      res.send(200,job);
    });
  },
  create (req,res,next) {
    debug.log('new task received');
    // console.log(req.body);
    // return res.send(200, json.success('ok', req.body));

    var task = req.task ;
    var user = req.user ;
    var customer = req.customer ;

    if(!task) return res.send(400,json.error('task required'));
    if(!user) return res.send(400,json.error('user required'));
    if(!customer) return res.send(400,json.error('customer required'));

    JobService.create({
      task: task,
      user: user,
      customer: customer,
      notify: true
    },(error,job) => {
      res.send(200,{job: job});
    });
  },
  schedule(req, res, next){
    // console.log('CONTROLLER SCHEDULE');
    // console.log(req.body);
    // console.log(req.params);

    var task_id = req.body.task_id || req.params.task_id ;
    var schedule = req.body.scheduleData;

    if(!task_id) return res.send(400,json.error('task required'));

    if(!schedule || !schedule.runDate) {
      return res.send(406,json.error('Must have a date'));
    }
    var user = req.user ;
    var customer = req.customer ;

    if(!user) return res.send(400,json.error('user required'));
    if(!customer) return res.send(400,json.error('customer required'));

    Task.findById(task_id,function(error,task){
      if(error) {
        debug.error('unable to fetch tasks database');
        res.send(500, json.error('internal error'));
      } else {
        if( task == null ) {
          res.send(400, json.error('invalid task provided'));
        } else {
          // var job = scheduler.scheduleTask();
          //estaria bueno aca solo guardar para el agendaJob
          //los ._id de cada uno de estos, y luego que los busque el processor
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
          jobData.user = user;
          jobData.name = task.name ;
          jobData.customer_id = customer._id;
          jobData.customer_name = customer.name;
          jobData.state = 'new' ;
          jobData.notify = true ;
          jobData.scheduleData = schedule;

          // console.log(jobData);
          Scheduler.scheduleTask(jobData, function(err){
            if(err) {
              console.log(err);
              console.log(arguments);
              res.send(500, err);
            }
            res.send(200, {nextRun : schedule.runDate});
          });
        }
      }
    });
  }
};
