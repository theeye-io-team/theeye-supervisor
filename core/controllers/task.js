var debug = require('../lib/logger')('eye:supervisor:controller:task');
var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var Task = require(process.env.BASE_PATH + '/entity/task').Entity;
var TaskService = require(process.env.BASE_PATH + '/service/task');
var Script = require(process.env.BASE_PATH + '/entity/script').Entity;
var Resource = require(process.env.BASE_PATH + '/entity/resource').Entity;
var Host = require(process.env.BASE_PATH + '/entity/host').Entity;
var resolver = require('../router/param-resolver');
var filter = require('../router/param-filter');

module.exports = function(server, passport){
  server.get('/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'}),
  ],controller.get);

  server.get('/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'host'})
  ], controller.fetch);

  server.patch('/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'}),
    resolver.idToEntity({param:'host'}),
    resolver.idToEntity({param:'resource'}),
    resolver.idToEntity({param:'script'}),
  ],controller.patch);

  server.post('/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'script'})
  ],controller.create);

  server.del('/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'}),
  ],controller.remove);
};


var controller = {
  /**
   *
   * @method POST
   * @author Facundo
   *
   */
   create (req, res, next) {
     var input = {
       'customer': req.customer,
       'user': req.user,
       'script': req.script,
       'description': req.body.description,
       'name': req.body.name,
       'hosts': req.body.hosts,
       'public': false
     };

     if(req.body.public){
       input.public = filter.toBoolean(req.body.public);
     }

     var scriptArgs = filter.toArray(req.body.script_arguments);
     input.script_arguments = scriptArgs;

     if(!input.script) return res.send(400, json.error('script is required'));
     if(!input.customer) return res.send(400, json.error('customer is required'));
     if(!input.hosts) return res.send(400, json.error('hosts are required'));
     TaskService.createManyTasks(input, function(error, tasks) {
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
      res.send(200, { task: published });
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

    Task.remove({
      _id : task._id
    }, function(error){
      if(error) return res.send(500);
      res.send(204);
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
    if(req.body.public){
      input.public = filter.toBoolean(req.body.public);
    }
    if(req.body.description) input.description = req.body.description;
    if(req.body.name) input.name = req.body.name;
    if(req.resource) {
      input.resource_id = req.resource._id;
    }
    // if it is set to something that it is not a resource
    else if(typeof req.body.resource != 'undefined') {
      input.resource_id = 0;
    }

    var scriptArgs = filter.toArray(req.body.script_arguments);
    if( scriptArgs.length > 0 ) input.script_arguments = scriptArgs;

    debug.log('updating task %j', input);
    task.update(input, function(error){
      if(error) return res.send(500,error);
      debug.log('publishing task');
      task.publish(function(pub){
        res.send(200,{task : pub});
      });
    });
  }
};
