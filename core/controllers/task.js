"use strict";

var debug = require('../lib/logger')('eye:supervisor:controller:task');
var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var Task = require(process.env.BASE_PATH + '/entity/task').Entity;
var TaskService = require(process.env.BASE_PATH + '/service/task');
var Script = require(process.env.BASE_PATH + '/entity/script').Entity;
var Host = require(process.env.BASE_PATH + '/entity/host').Entity;
var resolver = require('../router/param-resolver');
var filter = require('../router/param-filter');

module.exports = function(server, passport){
  server.get('/:customer/task/:task',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'task'}),
  ],controller.get);

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
    resolver.idToEntity({param:'script'}),
  ],controller.patch);

  server.post('/:customer/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'script'})
  ],controller.create);

  server.del('/:customer/task/:task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'task'}),
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
  }
};
