"use strict";

const extend = require('lodash/assign');
const logger = require('../lib/logger')('controller:task');
const json = require('../lib/jsonresponse');
const TaskService = require('../service/task');
const router = require('../router');
const dbFilter = require('../lib/db-filter');
const ACL = require('../lib/acl');
const ErrorHandler = require('../lib/error-handler');

module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ];

  server.get('/:customer/task',middlewares.concat([
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'host' })
  ]),controller.fetch);

  server.get('/:customer/task/:task',middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity:{ name: 'task' } })
  ),controller.get);

  server.post('/:customer/task',middlewares.concat([
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'script', entity: 'file' })
  ]),controller.create);

  var mws = middlewares.concat(
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.resolve.idToEntity({ param: 'host_id', entity: 'host', into: 'host' })
  );
  server.patch('/:customer/task/:task', mws, controller.update)
  server.put('/:customer/task/:task', mws, controller.update)
  server.del('/:customer/task/:task', mws, controller.remove)
}

var controller = {
  /**
   *
   * @method POST
   * @author Facugon
   *
   */
  create (req, res, next) {
    var errors = new ErrorHandler();
    var input = extend({},req.body,{
      customer: req.customer,
      user: req.user,
      script: req.script
    });

    input.hosts||(input.hosts=req.body.host);

    if (!input.type) return res.send(400, errors.required('type', input.type));
    if (!input.hosts) return res.send(400, errors.required('hosts', input.hosts));
    if (Array.isArray(input.hosts)) {
      if (input.hosts.length===0) {
        return res.send(400, errors.required('hosts', input.hosts));
      }
    } else {
      input.hosts = [ input.hosts ];
    }

    if (!input.name) return res.send(400, errors.required('name', input.name));

    TaskService.createManyTasks(input, function(error, tasks){
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
    filter.where.customer_id = customer.id;

    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email;
    }

    TaskService.fetchBy(filter, function(error, tasks) {
      if (error) return res.send(500);
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
    TaskService.populate(
      req.task,
      (err,data) => res.send(200, data)
    )
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
        res.send(200,{});
      },
      fail:function(error){
        res.send(500,error);
      }
    });
  },
  /**
   *
   * @author Facundo
   * @method PATCH/PUT
   * @route /task/:task
   * @param {String} :task , mongo ObjectId
   * @param ...
   *
   */
  update (req,res,next) {
    var errors = new ErrorHandler();
    var input = extend({},req.body);

    if (!req.task) return res.send(400, errors.required('task'));
    if (!req.host) return res.send(400, errors.required('host'));
    if (!input.name) return res.send(400, errors.required('name'));

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
  }
};
