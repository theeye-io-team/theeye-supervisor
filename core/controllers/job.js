var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var Job = require(process.env.BASE_PATH + "/entity/job").Entity;
var JobService = require(process.env.BASE_PATH + "/service/job");
var Task = require(process.env.BASE_PATH + "/entity/task").Entity;
var debug = require('../lib/logger')('eye:supervisor:controller:job');
var notificationService = require('../service/notification');
var paramsResolver = require('../router/param-resolver');

module.exports = function(server, passport) {
	server.get('/job/:id',[
    passport.authenticate('bearer', {session:false}),
  ],controller.get);

  server.get('/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.hostnameToHost({})
  ], controller.fetch);

  server.put('/job/:id',[
    passport.authenticate('bearer', {session:false}),
  ],controller.update);

  server.post('/job',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({})
  ],controller.create);

  /*
  return {
    routes: [
      {
        route: '/job',
        method: 'get',
        middleware: [
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
}

var controller = {
  get : function (req, res, next) {
    var id = req.params.id ;
    Job.findById(id,function(error,job){
      if(job == null){
        res.send(404,json.error('job not found'));
      } else {
        job.publish(function(error,published){
          res.send(200,{ job : published });
        });
      }
    });
  },
  fetch : function (req, res, next) {
    debug.log('querying jobs');
    if(!req.host) return res.send(400,json.error('host is required'));

    var input = { host: req.host };

    if( req.params.process_next ) {
      JobService.processNextJob(input,function(error,job){
        if( job != null ) {
          var msg = 'next job ready' ;
          var jobs = [ job ];
        } else {
          var msg = 'no more jobs' ;
          var jobs = [] ;
        }

        res.send(200, { jobs : jobs });
      });
    } else {
      res.send(400, json.error('invalid request'));
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
              topicArn : "jobs",
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
            job.publish(function(published){
              res.send(200, {job : published});
            });
          });
        }
      }
    });
  }
}
