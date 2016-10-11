"use strict";

var logger = require('../lib/logger')('eye:supervisor:controller:task');
var json = require('../lib/jsonresponse');
var TaskService = require('../service/task');
var router = require('../router');
var resolver = router.resolve;
var filter = router.filter;
var extend = require('lodash/assign');

module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    router.userCustomer,
    resolver.idToEntity({param:'task'})
  ];

  server.get('/:customer/task/:task',middlewares,controller.get);
  server.patch('/:customer/task/:task',middlewares,controller.patch);
  server.del('/:customer/task/:task',middlewares,controller.remove);


  server.get('/:customer/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'host'})
  ], controller.fetch);

  server.post('/:customer/task',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'script'})
  ],controller.create);

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
        logger.error(error);
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

    logger.log('fetching tasks');
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

    logger.log('updating task %j', input);
    TaskService.update({
      user: req.user,
      customer: req.customer,
      task: req.task,
      updates: input,
      done: function(task){
        res.send(200,task);
      },
      fail: function(error){
        logger.error(error);
        res.send(500);
      }
    });
  },
};
