const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router');
const TopicsConstants = require('../../constants/topics')
const MonitorConstants = require('../../constants/monitors')
const crudTopic = TopicsConstants.monitor.crud
const logger = require('../../lib/logger')('controller:monitor')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  // default middlewares
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  /** 
  * @openapi
  * /monitor/nested/{resource}:
  *   get:
  *     summary: Get a nested monitor by Id.
  *     description: Get a specific nested monitor by it's Id.
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

  server.get(
    '/monitor/nested/:resource',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.ensureAllowed({ entity: { name: 'resource' } }),
    controller.get
  )

  /** 
  * @openapi
  * /monitor/nested/{resource}:
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

  server.put(
    '/monitor/nested/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.replace
  )

  /** 
  * @openapi
  * /monitor/nested:
  *   post:
  *     summary: Create nested monitor.
  *     description: Create a nested monitor.
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

  server.post(
    '/monitor/nested',
    middlewares,
    router.requireCredential('admin'),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.create
  )

  /** 
  * @openapi
  * /monitor/nested/{resource}:
  *   delete:
  *     summary: Delete nested monitor by Id.
  *     description: Delete a specific nested monitor by it's Id.
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

  server.del(
    '/monitor/nested/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param:'resource',required:true}),
    controller.remove,
    audit.afterRemove('resource',{ display: 'name', topic: crudTopic })
  )
}

const controller = {
  /**
   *
   * @method GET
   *
   */
  get (req, res, next) {
    var resource = req.resource

    App.Models.Monitor.Entity.findOne({ resource: resource._id })
      .exec(function (err, monitor) {
        var data = resource.toObject()
        data.monitor = monitor
        res.send(200, data)
        next()
      })
  },
  /**
   * @method POST
   */
  create (req, res, next) {
    const customer = req.customer
    const body = req.body

    const params = App.resourceMonitor.validateData(filterRequestBody(body))
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    let input = params.data
    input.user = req.user
    input.customer = customer
    input.customer_id = customer.id
    input.customer_name = customer.name

    App.resource.create(input, (err, resource) => {
      if (err) {
        res.send(err.statusCode || 500, err.errors)
      } else {
        res.send(201, resource)
        next()
      }
    })
  },
  /**
   * @method PUT
   */
  async replace (req, res) {
    try {
      const resource = req.resource
      const body = req.body

      const params = App.resourceMonitor.validateData(
        filterRequestBody(
          Object.assign({}, body, { acl: req.acl })
        )
      )

      if (params.errors && params.errors.hasErrors()) {
        throw new ClientError(params.errors)
      }

      await App.resource.update({ resource, updates: params.data })
      //await resource.populate('monitor')
      res.send(200, resource)
    } catch (e) {
      res.sendError(err)
    }
  },
  remove (req, res, next) {
    App.resource.remove({
      resource: req.resource,
      notifyAgents: true,
      user: req.user
    }, err => {
      if (err) {
        res.send(500)
      } else {
        res.send(204)
      }
      next()
    })
  }
}

const filterRequestBody = (body) => {
  return {
    name: body.name,
    tags: body.tags,
    acl: body.acl,
    monitors: body.monitors,
    description: body.description,
    failure_severity: body.failure_severity || MonitorConstants.MONITOR_SEVERITY_HIGH,
    type: MonitorConstants.RESOURCE_TYPE_NESTED
  }
}
