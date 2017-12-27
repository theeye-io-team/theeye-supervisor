'use strict'

const lodash = require('lodash')
const async = require('async')
const router = require('../router')
const logger = require('../lib/logger')('eye:controller:hostgroup')
const HostGroup = require('../entity/host/group').Entity
const HostGroupService = require('../service/host/group')
const audit = require('../lib/audit')
const TopicsConstants = require('../constants/topics')

/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  const crudTopic = TopicsConstants.hostgroup.crud
  const middleware = [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
  ]

  server.get('/:customer/hostgroup',middleware,controller.fetch)
  server.post(
    '/:customer/hostgroup',
    middleware,
    controller.create,
    audit.afterCreate('group', { display: 'name', topic: crudTopic })
  )

  server.get('/:customer/hostgroup/:group',
    middleware.concat(
      router.resolve.idToEntity({
        param: 'group',
        entity: 'host/group',
        required: true
      })
    ), controller.get
  )

  server.put('/:customer/hostgroup/:group',
    middleware.concat(
      router.resolve.idToEntity({
        param: 'group',
        entity: 'host/group',
        required: true
      })
    ),
    controller.replace,
    audit.afterReplace('group', { display: 'name', topic: crudTopic })
  )

  server.del('/:customer/hostgroup/:group',
    middleware.concat(
      router.resolve.idToEntity({
        param: 'group',
        entity: 'host/group',
        required: true
      })
    ),
    controller.remove,
    audit.afterRemove('group', { display: 'name', topic: crudTopic })
  )
}

/**
 *
 * @route /group
 * group controller
 * @author Facundo
 *
 */
const controller = {
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  get (req,res,next) {
    const group = req.group
    HostGroupService.populate(group,(error,data) => {
      res.send(200,data)
    })
  },
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  fetch (req,res,next) {
    const customer = req.customer

    HostGroup.find({
      customer_name: customer.name
    }).exec(function (err,groups) {

      if (groups.length === 0) {
        return res.send(200,[])
      }

      const result = []
      const done = lodash.after(
        groups.length,
        () => res.send(200, result)
      )

      for (var i=0; i<groups.length; i++) {
        HostGroupService.populate(
          groups[i],
          function (err,data) {
            result.push(data)
            done()
          }
        )
      }
    })
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   *
   */
  remove (req,res,next) {
    const group = req.group
    HostGroupService.remove({
      group: group,
      user: req.user
    },(err) => {
      if (err) {
        logger.error(err)
        res.send(500)
      } else {
        res.send(200)
        next()
      }
    })
  },
  /**
   *
   * @author Facugon
   * @method POST
   *
   * @param {Object[]} req.body.hosts , hosts to add to the group
   * @param {Object[]} req.body.resources , resources/monitors templates definitions
   * @param {Object[]} req.body.tasks , tasks templates definitions
   * @param {Object[]} req.body.triggers , link monitors and tasks to anothe tasks view events
   * @todo req.body.triggers[] need validation here !
   * @param {String} req.body.triggers[].task_id , the id of the task for this trigger
   * @param {String[]} req.body.triggers[].events , array of event ids which belongs to the same host as the tasks host (can be triggered by tasks and monitors)
   *
   */
  create (req, res, next) {
    const body = req.body
    const hostname_regex = body.hostname_regex
    const host_origin = req.body.copy_host

    if (typeof hostname_regex === 'string') {
      try {
        new RegExp(hostname_regex)
      } catch(e) {
        return res.send(400, 'Invalid regular expression')
      }
    }

    HostGroupService.create( Object.freeze({
      //user_id: req.user._id,
      //customer_id: req.customer._id,
      //customer_name: req.customer.name,
      host_origin: host_origin,
      user: req.user,
      customer: req.customer,
      name: body.name,
      description: body.description,
      hostname_regex: hostname_regex,
      hosts: body.hosts || [], // Array of valid Host ids
      tasks: body.tasks || [], // Array of Objects with task definition
      triggers: body.triggers || [], // Array of Objects with a task id and related triggers ids
      resources: body.resources || [] // Array of Objects with resources and monitors definition, all mixed
    }), (err, group) => {
      if (err) {
        err.statusCode || (err.statusCode = 500)
        responseError(err, res)
      } else {
        res.send(200, group)
        req.group = group
        next()
      }
    })
  },
  /**
   *
   * @author Facundo
   * @method PUT
   *
   */
  replace (req, res, next) {
    const body = req.body

    const hostname_regex = body.hostname_regex
    if (typeof hostname_regex === 'string') {
      try {
        new RegExp(hostname_regex)
      } catch(e) {
        return res.send(400, 'Invalid regular expression')
      }
    }

    HostGroupService.replace({
      customer: req.customer,
      group: req.group,
      name: body.name,
      description: body.description,
      hostname_regex: hostname_regex,
      hosts: body.hosts || [], // Array of valid Host ids
      tasks: body.tasks || [], // Array of Objects with task definition
      resources: body.resources || [] // Array of Objects with resources and monitors definition, all mixed
    }, (err, group) => {
      if (err) {
        logger.error(err)
        err.statusCode || (err.statusCode = 500)
        responseError(err, res)
      } else {
        res.send(200, group)
        next()
      }
    })
  }
}

const responseError = (e,res) => {
  const errorRes = {
    error: e.message,
    info: []
  }
  if (e.info) {
    errorRes.info.push( e.info.toString() )
  }
  res.send( e.statusCode || 500, errorRes )
}
