var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var Job = require(process.env.BASE_PATH + "/entity/job").Entity;
var JobService = require(process.env.BASE_PATH + "/service/job");
var Task = require(process.env.BASE_PATH + "/entity/task").Entity;
var debug = require('../lib/logger')('eye:supervisor:controller:job');
var notificationService = require('../service/notification');
var paramsResolver = require('../router/param-resolver');
var scheduler;
var elastic = require('../lib/elastic');
var globalconfig = require('config');

module.exports = function(server, passport) {
  //bring the scheduler from server
  scheduler = server.scheduler;

  server.get('/:customer/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ], controller.fetch);

  server.get('/:customer/job/:job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.idToEntity({param:'job'})
  ],controller.get);

  server.put('/:customer/job/:id',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({})
  ],controller.update);

  server.post('/:customer/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({})
  ],controller.create);

  server.post('/:customer/job/schedule',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({})
  ],controller.schedule);

  /*
  return {
    routes: [
      {
        route: '/job',
        method: 'get',
        middleware: [
          paramsResolver.customerNameToEntity({}),
          paramsResolver.hostnameToHost({})
        ],
        action: controller.fetch
      }, {
        route: '/job',
        method: 'post',
        middleware: [
          paramsResolver.customerNameToEntity({}),
        ],
        action: controller.create
      }, {
        route: '/job/:job',
        method: 'get',
        middleware: [
          paramsResolver.idToEntity({param:'job'})
        ],
        action: controller.get
      }, {
        route: '/job/:job',
        method: 'put',
        middleware: [
          paramsResolver.idToEntity({param:'job'})
        ],
        action: controller.update
      },
    ]
  };
  */
};

function registerTaskExecution(customer,data){
  var key = globalconfig.elasticsearch.keys.task.execution;
  elastic.submit(customer,key,data);
}

var controller = {
  get: function(req,res,next) {
    var job = req.job;
    if(!job) return res.send(404,json.error('not found'));
    job.publish(function(pub){
      res.send(200,{'job':pub});
    });
  },
  fetch: function(req,res,next) {
    debug.log('querying jobs');
    if(!req.customer) return res.send(400,json.error('customer is required'));
    if(!req.host) return res.send(400,json.error('host is required'));
    var host = req.host;
    var customer = req.customer;

    var input = { host: req.host };

    if( req.params.process_next ) {
      JobService.processNextJob(input,function(error,job){
        var jobs = [];
        if( job != null ) {
          jobs.push(job);
        }
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
  update : function (req, res, next) {
    debug.log('Handling job updates');

    var id = req.params.id;
    var input = req.params.result ;

    Job.findById(id, function(error, job)
    {
      if( job != null )
      {
        if(job.name == 'agent:config:update') {
          job.state = 'agent-updated';
        } else {
          job.state = 'job-completed';
        }
        job.result = input;
        job.save();
        // notify job result to clients
        if( job.notify ) {
          job.publish(function(data) {
            notificationService.sendSNSNotification(data,{
              topic : "jobs",
              subject : "job_update"
            });
          });
        }

        res.send(200);
      }
      else return res.send(404, json.error("not found"));
    });
  },
  create : function(req,res,next) {
    debug.log('new task received');
    // console.log(req.body);
    // return res.send(200, json.success('ok', req.body));

    var task_id = req.body.task_id || req.params.task_id ;
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
          Job.create({
            task: task,
            user: user,
            customer: customer,
            notify: true
          },function(job) {
						registerTaskExecution(customer.name,{
							'customer_name': customer.name,
              'user_id': user.id,
              'user_email': user.email,
              'task_id':task.id,
              'task_name':task.name,
              'script_id':task.script_id
						});

            job.publish(function(published){
              res.send(200, {job : published});
            });
          });
        }
      }
    });
  },
  schedule: function(req, res, next){
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
          jobData.user_id = user._id;
          jobData.name = task.name ;
          jobData.customer_id = customer._id;
          jobData.customer_name = customer.name;
          jobData.state = 'new' ;
          jobData.notify = true ;
          jobData.scheduleData = schedule;

          // console.log(jobData);
          scheduler.scheduleTask(jobData, function(err){
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
