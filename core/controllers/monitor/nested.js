const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router');
const TopicsConstants = require('../../constants/topics')
const MonitorConstants = require('../../constants/monitors')
//const Monitor = require('../../entity/monitor').Entity;
const crudTopic = TopicsConstants.monitor.crud
const logger = require('../../lib/logger')('controller:monitor')

module.exports = (server) => {
  // default middlewares
  var middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get('/monitor/nested/:resource',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.ensureAllowed({ entity: { name: 'resource' } }),
    controller.get
  )

  server.put('/monitor/nested/:resource',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.replace
  )

  server.post('/monitor/nested',
    middlewares,
    router.requireCredential('admin'),
    router.filter.spawn({ filter: 'emailArray', param: 'acl' }),
    controller.create
  )

  server.del('/monitor/nested/:resource',
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
  async replace (req, res, next) {
    try {
      const resource = req.resource
      const body = req.body

      const params = App.resourceMonitor.validateData(
        filterRequestBody(
          Object.assign({}, body, { acl: req.acl })
        )
      )

      if (params.errors && params.errors.hasErrors()) {
        return res.send(400, params.errors)
      }

      await App.resource.update({ resource, updates: params.data })
      //await resource.populate('monitor')
      res.send(200, resource)
      return next()
    } catch (e) {
      logger.error(e)
      if (e.statusCode) {
        res.send(e.statusCode, e.message)
      } else {
        res.send(500, e.message)
      }
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
