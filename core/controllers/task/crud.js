"use strict";

const extend = require('lodash/assign');
const isMongoId = require('validator/lib/isMongoId')
const App = require('../../app')
const logger = require('../../lib/logger')('controller:task');
const json = require('../../lib/jsonresponse');
const router = require('../../router');
const dbFilter = require('../../lib/db-filter');
const ACL = require('../../lib/acl');
const ErrorHandler = require('../../lib/error-handler');
const audit = require('../../lib/audit')
const TaskConstants = require('../../constants/task')

module.exports = (server, passport) => {
  server.get('/:customer/task', [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'host' })
  ], controller.fetch)

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

    if (input.type!==TaskConstants.TYPE_APPROVAL && input.type!==TaskConstants.TYPE_DUMMY) {
      if (!req.host) {
        errors[!req.body.host?'required':'invalid']('host', req.host)
      }
      input.host = req.host._id
      input.host_id = req.host._id
    }

    if (input.type===TaskConstants.TYPE_APPROVAL) {
      if (!validIdsArray(input.approvers)) {
        errors.required('approvers', input.approvers)
      }
    }

    if (input.type===TaskConstants.TYPE_SCRIPT) {
      if (!req.script) {
        errors[!req.body.script?'required':'invalid']('script', req.script)
      }
      input.script = req.script
    }

    if (input.type===TaskConstants.TYPE_SCRAPER) { }

    if (input.type===TaskConstants.TYPE_DUMMY) { }


    if (errors.hasErrors()){
      return res.send(400,errors)
    }

    App.task.create(input, (err,task) => {
      if (err) return res.sendError(err)
      App.task.populate(task, (err,data) => {
        if (err) return res.sendError(err)
        res.send(200,data)
        req.task = task
        next()
      })
    })
  },
  /**
   * @method GET
   * @route /task
   */
  fetch (req, res, next) {
    const host = req.host
    const customer = req.customer
    const input = req.query

    if (host) { input.host_id = host._id }

    const filter = dbFilter(input,{ /** default **/ })
    filter.where.customer_id = customer.id

    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    App.task.fetchBy(filter, function(error, tasks) {
      if (error) { return res.send(500) }
      res.send(200, tasks)
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
    App.task.populate(
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

    App.task.remove({
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

    if (req.task.type!==TaskConstants.TYPE_APPROVAL && input.type!==TaskConstants.TYPE_DUMMY) {
      if (!req.host) {
        errors[!req.body.host?'required':'invalid']('host', req.host)
      }
    }

    if (input.type===TaskConstants.TYPE_APPROVAL) {
      if (!validIdsArray(input.approvers)) {
        errors.required('approvers', input.approvers)
      }
    }

    if (req.task.type===TaskConstants.TYPE_SCRIPT) {
      if (!req.script) {
        errors[!req.body.script?'required':'invalid']('script', req.script)
      }
      input.script = req.script
    }
    if (input.type===TaskConstants.TYPE_SCRAPER) { }

    if (input.type===TaskConstants.TYPE_DUMMY) { }

    if (errors.hasErrors()){
      return res.send(400,errors)
    }

    logger.log('updating task %j', input)
    App.task.update({
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
}

const validIdsArray = (value) => {
  if (!value) {
    return false
  } else {
    if (!Array.isArray(value)) {
      return false
    } else {
      let invalid = value.find(_id => !isMongoId(_id))
      if (invalid) {
        return false
      }
    }
  }
  return true
}
