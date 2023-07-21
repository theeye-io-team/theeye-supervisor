const debug = require('debug')('controller:monitor')
const after = require('lodash/after')

const App = require('../../app')
const router = require('../../router')
const audit = require('../../lib/audit')
const TopicsConstants = require('../../constants/topics')
const MonitorConstants = require('../../constants/monitors')
const logger = require('../../lib/logger')('controller:monitor')

const Host = require('../../entity/host').Entity
const Resource = require('../../entity/resource').Entity
const Monitor = require('../../entity/monitor').Entity
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  const crudTopic = TopicsConstants.monitor.crud

  // default middlewares
  const middlewares = [
    server.auth.bearerMiddleware,
    async (req, res) => {
      //const customer = req.session.customer
      //req.customer = await App.Models.Customer.Entity.findById(customer.id)
      req.customer = req.session.customer
    },
    router.ensureCustomer
  ]

  /** 
  * @openapi
  * /monitor:
  *   get:
  *     summary: Get list of monitors.
  *     description: Get a list of monitors.
  *     tags:
  *         - Monitor
  *     responses:
  *       '200':
  *         description: Successfully retrieved the list of monitors.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.get('/monitor',
    middlewares,
    router.requireCredential('viewer'),
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  /** 
  * @openapi
  * /monitor/{resource}:
  *   get:
  *     summary: Get a monitor by Id.
  *     description: Get a specific monitor by it's Id.
  *     tags:
  *         - Monitor
  *     parameters:
  *       - name: Resource
  *         in: query
  *         description: Resource Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved monitor information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.get('/monitor/:resource',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.ensureAllowed({ entity: { name: 'resource' } }),
    controller.get
  )

  /** 
  * @openapi
  * /monitor/{resource}:
  *   delete:
  *     summary: Delete a monitor by Id.
  *     description: Delete a specific monitor by it's Id.
  *     tags:
  *         - Monitor
  *     parameters:
  *       - name: Resource
  *         in: query
  *         description: Resource Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully deleted monitor.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.del('/monitor/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    controller.remove,
    audit.afterRemove('resource', { display: 'name', topic: crudTopic })
  )

  /** 
  * @openapi
  * /monitor:
  *   post:
  *     summary: Create a monitor.
  *     description: Create a monitor.
  *     tags:
  *         - Monitor
  *     responses:
  *       '200':
  *         description: Successfully created monitor.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/monitor',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({
      param: 'host_id',
      entity: 'host',
      required: true,
      into: 'host'
    }),
    //router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.create,
    //audit.afterCreate('resource', { display: 'name', topic: crudTopic })
  )

  /** 
  * @openapi
  * /monitor/{resource}:
  *   put:
  *     summary: Update a monitor by Id.
  *     description: Update a specific monitor by it's Id.
  *     tags:
  *         - Monitor
  *     parameters:
  *       - name: Resource
  *         in: query
  *         description: Resource Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated monitor.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

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
    //router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    replace,
    audit.afterReplace('resource', { display: 'name', topic: crudTopic  })
  )

  /**
   * update single properties with custom behaviour
   */

  /** 
  * @openapi
  * /monitor/{resource}/alerts:
  *   patch:
  *     summary: Update monitor's properties by Id.
  *     description: Update a specific monitor's properties by it's Id.
  *     tags:
  *         - Monitor
  *     parameters:
  *       - name: Resource
  *         in: query
  *         description: Resource Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated monitor.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Monitor'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
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
    const filter = req.dbQuery
    filter.sort = { fails_count: -1, type: 1 }
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
  async create (req, res) {
    try {
      const customer = req.customer
      const body = req.body
      const host = req.host

      //body.acl = req.acl

      let params = App.resourceMonitor.validateData(body)
      if (params.errors && params.errors.hasErrors()) {
        throw new ClientError(params.errors)
      }

      const input = params.data
      input.user = req.user
      input.customer = customer.id
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
    } catch (err) {
      if (err.errors) {
        const messages = err.errors.map(e => {
          return { field: e.path, type: e.kind }
        })
        res.send(400, messages)
      } else {
        res.sendError(err)
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
const replace = async (req, res) => {
  try {
    const resource = req.resource
    const body = req.body
    body.host = req.host

    const params = App.resourceMonitor.validateData(Object.assign({}, body))
    if (params.errors && params.errors.hasErrors()) {
      throw new ClientError(params.errors)
    }

    const updates = {}
    if (resource.type === MonitorConstants.RESOURCE_TYPE_HOST) {
      updates.looptime = body.looptime
      updates.description = body.description
      updates.tags = body.tags
      updates.acl = body.acl
    } else {
      Object.assign(updates, params.data)
    }

    updates.failure_severity = verifyFailureSeverity(body.failure_severity)

    await updateResource(resource, updates)
    res.send(200, resource)
  } catch (e) {
    res.sendError(err)
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
