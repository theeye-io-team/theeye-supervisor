const debug = require('debug')('controller:monitor')
const after = require('lodash/after')

const App = require('../../app')
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')
const audit = require('../../lib/audit')
const TopicsConstants = require('../../constants/topics')
const MonitorConstants = require('../../constants/monitors')
const ACL = require('../../lib/acl')
const logger = require('../../lib/logger')('controller:monitor')

const Host = require('../../entity/host').Entity
const Resource = require('../../entity/resource').Entity
const Monitor = require('../../entity/monitor').Entity

module.exports = (server) => {
  const crudTopic = TopicsConstants.monitor.crud

  // default middlewares
  const middlewares = [
    server.auth.bearerMiddleware,
    async (req, res, next) => {
      //const customer = req.session.customer
      //req.customer = await App.Models.Customer.Entity.findById(customer.id)
      req.customer = req.session.customer
      next()
    },
    router.ensureCustomer
  ]

  server.get('/monitor',
    middlewares,
    router.requireCredential('viewer'),
    controller.fetch
  )

  server.get('/monitor/:resource',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.ensureAllowed({ entity: { name: 'resource' } }),
    controller.get
  )

  server.del('/monitor/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    controller.remove,
    audit.afterRemove('resource', { display: 'name', topic: crudTopic })
  )

  server.post('/monitor',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({
      param: 'host_id',
      entity: 'host',
      required: true,
      into: 'host'
    }),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.create,
    //audit.afterCreate('resource', { display: 'name', topic: crudTopic })
  )

  server.put('/monitor/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.resolve.idToEntity({
      param: 'host_id',
      entity: 'host',
      required: true,
      into: 'host'
    }),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    replace,
    audit.afterReplace('resource', { display: 'name', topic: crudTopic  })
  )

  /**
   * update single properties with custom behaviour
   */
  server.patch('/monitor/:resource/alerts',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    controller.update_alerts,
    audit.afterUpdate('resource', { display: 'name', topic: crudTopic })
  )
}

const controller = {
  /**
   *
   * @method GET
   *
   */
  get (req, res, next) {
    const resource = req.resource
    resource.populate('monitor', err => {
      res.send(200, resource)
    })
    //Monitor
    //  .findOne({ resource: resource._id })
    //  .exec((err, monitor) => {
    //    var data = resource.toObject()
    //    data.monitor = monitor
    //    res.send(200, data)
    //    next()
    //  })
  },
  /**
   *
   * @method GET
   *
   */
  fetch (req, res, next) {
    const filter = dbFilter(req.query, {
      sort: {
        fails_count: -1,
        type: 1
      }
    })

    filter.where.customer_id = req.customer.id;
    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    App.resource.fetchBy(filter, (err, resources) => {
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
   * @summary Create resource on single host
   * @method POST
   */
  async create (req, res, next) {
    try {
      const customer = req.customer
      const body = req.body
      const host = req.host

      body.acl = req.acl

      let params = App.resourceMonitor.validateData(body)
      if (params.errors && params.errors.hasErrors()) {
        return res.send(400, params.errors)
      }

      const input = params.data
      input.user = req.user
      input.customer = customer
      input.customer_id = customer.id
      input.customer_name = customer.name
      input.host_id = host._id
      input.host = host._id
      input.hostname = host.hostname
      // ensure severity

      const sev = input?.failure_severity || body?.failure_severity
      input.failure_severity = verifyFailureSeverity(sev)

      delete input.template
      delete input.monitor

      req.resource = await App.resource.create(input)
      logger.log('resources created')

      res.send(201, req.resource)
      next() // next middleware
    } catch (err) {
      if (err.errors) {
        let messages = err.errors.map(e => {
          return { field: e.path, type: e.kind }
        })
        return res.send(400, messages)
      } else {
        logger.error(err)
        return res.send(err.statusCode || 500, err)
      }
    }
  },
  /**
   *
   * @method DELETE
   *
   */
  remove (req, res, next) {
    const resource = req.resource

    if (resource.type == 'host') {
      logger.log('removing host resource')
      App.host.removeHostResource({
        resource,
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
      }, (err) => {
      })
      res.send(200,{})
      next()
    }
  },
  /**
   *
   * change the alert level
   * @author Facugon
   * @method PATCH
   * @route /monitor/:id/alerts
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
  }
}

/**
 *
 * @method PUT
 *
 */
const replace = async (req, res, next) => {
  try {
    const resource = req.resource
    const body = req.body
    body.host = req.host

    const params = App.resourceMonitor.validateData(Object.assign({}, body))
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    const updates = {}
    if (resource.type === MonitorConstants.RESOURCE_TYPE_HOST) {
      updates.looptime = body.looptime
      updates.description = body.description
      updates.tags = body.tags
      updates.acl = req.acl
    } else {
      Object.assign(updates, params.data, { acl: req.acl })
    }

    updates.failure_severity = verifyFailureSeverity(body.failure_severity)

    await updateResource(resource, updates)
    res.send(200, resource)
    next()
  } catch (e) {
    logger.error(e)
    if (e.statusCode) {
      res.send(e.statusCode, e.message)
    } else {
      res.send(500, e.message)
    }
  }
}

const updateResource = async (resource, updates) => {
  if (updates.host_id) {
    let host = await Host.findById(updates.host_id)
    if (!host) {
      let err = new Error('invalid host')
      err.statusCode = 400
      throw err
    }

    updates.host_id = host._id
    updates.host = host._id
    updates.hostname = host.hostname
  }

  return await App.resource.update({ resource, updates })
}

const verifyFailureSeverity = (value) => {
  if (!value || (
    value !== MonitorConstants.MONITOR_SEVERITY_LOW &&
    value !== MonitorConstants.MONITOR_SEVERITY_HIGH &&
    value !== MonitorConstants.MONITOR_SEVERITY_CRITICAL
  )) {
    return MonitorConstants.MONITOR_SEVERITY_LOW
  } else {
    return value
  }
}
