"use strict";

var extend = require('lodash/assign');
var logger = require('../lib/logger')('controller:task');
var json = require('../lib/jsonresponse');
var TaskService = require('../service/task');
var router = require('../router');
var dbFilter = require('../lib/db-filter');
var ACL = require('../lib/acl');

module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ];

  server.get('/:customer/task',middlewares.concat([
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'host'})
  ]),controller.fetch);

  server.get('/:customer/task/:task',middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'task',required:true})
  ),controller.get);

  server.post('/:customer/task',middlewares.concat([
    router.requireCredential('admin'),
    router.resolve.idToEntity({param:'script',required:true})
  ]),controller.create);

  var mws = middlewares.concat(
    router.requireCredential('admin'),
    router.resolve.idToEntity({param:'task',required:true})
  );
  server.patch('/:customer/task/:task',mws,controller.patch);
  server.del('/:customer/task/:task',mws,controller.remove);
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
      customer: req.customer,
      user: req.user,
      script: req.script
    });

    if (!input.type) return res.send(400, json.error('type is required'));
    if (!input.hosts) return res.send(400, json.error('a host is required'));
    if (Array.isArray(input.hosts)) {
      if (input.hosts.length===0) {
        return res.send(400, json.error('a host is required'));
      }
    } else {
      input.hosts = [ input.hosts ];
    }
    if (!input.name) return res.send(400, json.error('name is required'));
    //if (input.type=='script'){
    //  if (!input.script) return res.send(400, json.error('script is required'));
    //} else if(input.type=='scraper'){
    //}

    TaskService.createManyTasks(input, function(error, tasks) {
      if (error) {
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

    var input = req.query;
    if (host) input.host_id = host._id;

    var filter = dbFilter(input,{ /** default **/ });
    filter.where.customer_id = customer._id;

    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = {
        $elemMatch: {
          $or:[
            { user: req.user._id },
            { email: req.user.email }
          ]
        }
      };
    }

    TaskService.fetchBy(filter, function(error, tasks) {
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
  patch (req,res,next) {
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
