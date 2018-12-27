'use strict';

const App = require('../../app')
const logger = require('../../lib/logger')('controller:resource');
const json = require('../../lib/jsonresponse');
const ResourceManager = require('../../service/resource');
const HostsManager = require('../../service/host');
const MonitorManager = require('../../service/resource/monitor');
const Resource = require('../../entity/resource').Entity;
const Monitor = require('../../entity/monitor').Entity;
const Host = require('../../entity/host').Entity;
const Job = require('../../entity/job').Job;
const router = require('../../router');
const dbFilter = require('../../lib/db-filter');
const audit = require('../../lib/audit')
const ACL = require('../../lib/acl');
const TopicsConstants = require('../../constants/topics')

module.exports = function (server, passport) {
  const crudTopic = TopicsConstants.monitor.crud

  // default middlewares
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ]

  server.get(
    '/:customer/resource',
    middlewares.concat([
      router.requireCredential('viewer'),
    ]),
    controller.fetch
  )

  server.get(
    '/:customer/resource/:resource',
    middlewares.concat([
      router.requireCredential('viewer'),
      router.resolve.idToEntity({param:'resource',required:true}),
      router.ensureAllowed({entity:{name:'resource'}})
    ]),
    controller.get
  )

  server.post(
    '/:customer/resource',
    middlewares.concat([
      router.requireCredential('admin'),
      router.filter.spawn({filter:'emailArray',param:'acl'})
    ]),
    controller.bulkCreate
    //audit.afterCreate('resource',{ display: 'name' }) // cannot audit bulk creation
  )

  server.del(
    '/:customer/resource/:resource',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param:'resource',required:true})
    ]),
    controller.remove,
    audit.afterRemove('resource',{ display: 'name', topic: crudTopic })
  )

  var updateMiddlewares = middlewares.concat([
    router.requireCredential('agent'),
    router.resolve.idToEntity({param:'resource',required:true}),
    //router.resolve.idToEntity({param:'host_id',entity:'host',into:'host'}),
    router.filter.spawn({filter:'emailArray',param:'acl'})
  ])

  server.patch(
    '/:customer/resource/:resource',
    updateMiddlewares,
    controller.update,
    audit.afterReplace('resource',{ display: 'name', topic: crudTopic  })
  )

  //
  // KEEP BACKWARD COMPATIBILITY WITH OLDER AGENT VERSIONS.
  // SUPPORTED FROM VERSION v0.9.3-beta-11-g8d1a93b
  //
  server.put(
    '/:customer/resource/:resource',
    updateMiddlewares,
    function(req,res,next){
      // some older version of the agent are still updating resources state using this URL. need to keep it
      if (req.user.credential==='agent') {
        controller.update_state.apply(controller, arguments);
      } else {
        controller.update.apply(controller, arguments);
      }
    },
    audit.afterReplace('resource',{ display: 'name', topic: crudTopic })
  )

  /**
   *
   * update single properties with custom behaviour
   *
   */
  server.patch(
    '/:customer/resource/:resource/alerts',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param:'resource',required:true})
    ]),
    controller.update_alerts,
    audit.afterUpdate('resource',{ display: 'name', topic: crudTopic })
  )

  server.patch(
    '/:customer/resource/:resource/state',
    middlewares.concat([
      router.requireCredential('agent',{exactMatch:true}),
      router.resolve.idToEntity({param:'resource',required:true})
    ]),
    controller.update_state,
    audit.afterUpdate('resource',{ display: 'name', topic: crudTopic })
  )
}

const controller = {
  /**
   *
   * @method GET
   *
   */
  get (req,res,next) {
    var resource = req.resource;
    Monitor
      .findOne({ resource: resource._id })
      .exec(function(err,monitor){
        var data = resource.toObject()
        data.monitor = monitor
        res.send(200, data)
        next()
      })
  },
  /**
   *
   * @method GET
   *
   */
  fetch (req,res,next) {
    var filter = dbFilter(req.query,{
      sort: {
        fails_count: -1,
        type: 1
      }
    })

    filter.where.customer_id = req.customer._id;
    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    App.resource.fetchBy(filter,(err,resources) => {
      if (err) {
        logger.error(err)
        res.send(500)
      } else if (!Array.isArray(resources)) {
        res.send(503, new Error('resources not available'))
      } else {
        if (resources.length===0) {
          res.send(200,[])
          next()
        } else {
          var resource
          for (var i=0; i<resources.length; i++) {
            resource = resources[i]
          }
          res.send(200,resources)
          next()
        }
      }
    })
  },
  /**
   *
   * @method DELETE
   *
   */
  remove (req,res,next) {
    const resource = req.resource

    if (resource.type == 'host') {
      logger.log('removing host resource')
      HostsManager.removeHostResource({
        resource: resource,
        user: req.user
      })
      res.send(200,{})
      next()
    } else {
      logger.log('removing resource')
      App.resource.remove({
        resource: resource,
        notifyAgents: true,
        user: req.user
      })
      res.send(200,{})
      next()
    }
  },
  /**
   * @summary Create many resources on hosts
   * @method POST
   */
  bulkCreate (req,res,next) {
    const customer = req.customer
    const body = req.body
    const hosts = body.hosts

    body.acl = req.acl;

    if (!hosts) {
      return res.send(400, [{
        field: 'hosts',
        message: 'a host is required',
        value: hosts,
        code: 'EREQ'
      }])
    }

    if (!Array.isArray(hosts)) hosts = [hosts]

    var params = MonitorManager.validateData(body)
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    var input = params.data
    input.user = req.user
    //input.user_id = req.user._id
    //input.user_email = req.user.email
    input.customer = customer
    input.customer_id = customer.id
    input.customer_name = customer.name

    App.resource.createResourceOnHosts(hosts, input, (error,results) => {
      if (error) {
        if (error.errors) {
          var messages=[]
          for (var err in error.errors) {
            var e = errors[err]
            messages.push({ field: e.path, type: e.kind })
          }
          return res.send(400, error.errors)
        } else {
          logger.error(error)
          return res.send(500, json.error('internal error', error))
        }
      } else {
        logger.log('resources created')
        res.send(201, results)
        next()
      }
    })
  },
  /**
   *
   * @method PATCH
   *
   */
  update (req,res,next) {
    const resource = req.resource
    const body = req.body
    var updates

    body.host = req.host
    body.acl = req.acl

    const params = MonitorManager.validateData(body)
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    if (resource.type=='host') {
      updates = {
        acl: req.acl,
        tags: body.tags
      }
    } else {
      updates = params.data
    }

    const doUpdate = () => {
      App.resource.update({
        resource,
        updates
      }, (err,resource) => {
        if (err) {
          logger.error(err)
          res.send(500)
        } else {
          res.send(200,resource)
          next()
        }
      })
    }

    if (updates.host_id) {
      Host.findById(updates.host_id, (err, host) => {
        if (err) {
          logger.error(err)
          res.send(500)
        }

        if (!host) { return res.send(400,'invalid host') }

        updates.host_id = host._id
        updates.host = host._id
        updates.hostname = host.hostname
        doUpdate()
      })
    } else {
      doUpdate()
    }
  },
  /**
   *
   * change the alert level
   * @author Facugon
   * @method PATCH
   * @route /:customer/resource/:id/alerts
   *
   */
  update_alerts (req, res, next) {
    const resource = req.resource
    resource.alerts = req.body.alerts
    resource.save(err => {
      if (err) {
        res.send(500)
      } else {
        res.send(200, resource)
        next()
      }
    })
  },
  /**
   *
   * @author Facugon
   * @method PATCH
   * @route /:customer/resource/:id/state
   *
   */
  update_state (req,res,next) {
    const resource = req.resource
    const input = req.body
    const manager = new ResourceManager(resource)
    manager.handleState(input, err => {
      if (err) {
        logger.error(err)
        res.send(500)
      } else {
        res.send(200,resource)
        next()
      }
    })
  }
}
