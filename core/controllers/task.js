"use strict";

const App = require('../app')
const extend = require('lodash/assign');
const logger = require('../lib/logger')('controller:task');
const json = require('../lib/jsonresponse');
const TaskService = require('../service/task');
const router = require('../router');
const dbFilter = require('../lib/db-filter');
const ACL = require('../lib/acl');
const ErrorHandler = require('../lib/error-handler');
const audit = require('../lib/audit')
const TaskConstants = require('../constants/task')
const isMongoId = require('validator/lib/isMongoId')

module.exports = (server, passport) => {
  server.get('/:customer/task', [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'host' })
  ] , controller.fetch)

  server.get('/:customer/task/:task' , [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } })
  ] , controller.get)

  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  server.post(
    '/:customer/task',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param: 'script', entity: 'file' }),
      router.resolve.idToEntity({ param: 'host' })
    ]),
    controller.create,
    audit.afterCreate('task',{ display: 'name' })
  )

  var mws = middlewares.concat(
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.resolve.idToEntity({ param: 'host_id', entity: 'host', into: 'host' })
  );
  server.patch(
    '/:customer/task/:task',
    mws,
    controller.update,
    audit.afterUpdate('task',{ display: 'name' })
  )
  server.put(
    '/:customer/task/:task',
    mws,
    router.resolve.idToEntity({ param: 'script', entity: 'file' }),
    controller.update,
    audit.afterReplace('task',{ display: 'name' })
  )
  server.del(
    '/:customer/task/:task',
    mws,
    controller.remove,
    audit.afterRemove('task',{ display: 'name' })
  )

  server.get(
    '/task/:task/recipe',
    [
      passport.authenticate('bearer', { session: false }),
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('user'),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.ensureAllowed({ entity: { name: 'task' } })
    ],
    controller.recipe
  )
}

const controller = {
  create (req, res, next) {
    const errors = new ErrorHandler()
    const input = extend({},req.body,{
      customer: req.customer,
      customer_id: req.customer._id,
      user: req.user,
      user_id: req.user_id
    })

    if (!input.name) errors.required('name', input.name)
    if (!input.type) errors.required('type', input.type)

    if (input.type!==TaskConstants.TYPE_APPROVAL) {
      if (!req.host) {
        errors[!req.body.host?'required':'invalid']('host', req.host)
      }
      input.host = req.host._id
      input.host_id = req.host._id
    } else {
      if (!input.approver_id) {
        errors.required('approver_id', req.approver_id)
      } else if (!isMongoId(input.approver_id)) {
        errors.invalid('approver_id', req.approver_id)
      }
    }

    if (input.type===TaskConstants.TYPE_SCRIPT) {
      if (!req.script) {
        errors[!req.body.script?'required':'invalid']('script', req.script)
      }
      input.script = req.script
    }
    if (input.type===TaskConstants.TYPE_SCRAPER) { }

    if (errors.hasErrors()){
      return res.send(400,errors)
    }

    TaskService.create(input, (err,task) => {
      if (err) return res.sendError(err)
      TaskService.populate(task, (err,data) => {
        if (err) return res.sendError(err)
        res.send(200,data)
        req.task = task
        next()
      })
    })
  },
  /**
   * @author Facundo
   * @method GET
   * @route /task
   */
  fetch (req, res, next) {
    const host = req.host
    const customer = req.customer
    const input = req.query

    if (host) input.host_id = host._id

    const filter = dbFilter(input,{ /** default **/ })
    filter.where.customer_id = customer.id

    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    TaskService.fetchBy(filter, function(error, tasks) {
      if (error) return res.send(500)
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
      (err,data) => {
        res.send(200, data)
      }
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
        next()
      },
      fail: (err) => { res.sendError(err) }
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
    var errors = new ErrorHandler()
    var input = extend({},req.body)

    if (!req.task) return res.send(400, errors.required('task'))
    if (!input.name) return res.send(400, errors.required('name'))

    if (req.task.type!==TaskConstants.TYPE_APPROVAL) {
      if (!req.host) {
        errors[!req.body.host?'required':'invalid']('host', req.host)
      }
    } else {
      if (!input.approver_id) {
        errors.required('approver_id', req.approver_id)
      } else if (!isMongoId(input.approver_id)) {
        errors.invalid('approver_id', req.approver_id)
      }
    }

    if (req.task.type===TaskConstants.TYPE_SCRIPT) {
      if (!req.script) {
        errors[!req.body.script?'required':'invalid']('script', req.script)
      }
      input.script = req.script
    }
    if (input.type===TaskConstants.TYPE_SCRAPER) { }

    if (errors.hasErrors()){
      return res.send(400,errors)
    }

    logger.log('updating task %j', input)
    TaskService.update({
      user: req.user,
      customer: req.customer,
      task: req.task,
      updates: input,
      done: function (task) {
        res.send(200, task)
        next()
      },
      fail: function (err) {
        logger.error('%o',err)
        res.sendError(err)
      }
    })
  },
  /**
   *
   * @summary get the recipe of a task
   * @method GET
   * @route /task/:task/recipe
   * @param {WebRequest} req
   * @property {Task} req.task
   * @property {Customer} req.customer
   * @property {User} req.user
   * @authenticate
   *
   */
  recipe (req, res, next) {
    let task = req.task

    App.task.getRecipe(task, (err, recipe) => {
      if (err) {
        return res.send(err.statusCode || 500, err)
      }

      res.send(200, recipe)
      next()
    })
  }
}
