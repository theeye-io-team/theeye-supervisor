const App = require('../../app')
const logger = require('../../lib/logger')('controller:resource')
const router = require('../../router')
const audit = require('../../lib/audit')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')

module.exports = function (server) {
  const crudTopic = TopicsConstants.monitor.crud

  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('agent', { exactMatch: true }),
    router.resolve.idToEntity({ param: 'resource', required: true })
  ]

  const execution_logger = (req, res, next) => {
    const resource = req.resource
    let payload = {
      hostname: resource.hostname,
      organization: resource.customer_name,
      model_name: resource.name,
      model_type: resource.type,
      model_id: resource._id,
      operation: Constants.UPDATE,
      result: resource.last_event.data,
      state: resource.state
    }

    const topic = TopicsConstants.monitor.execution
    App.logger.submit(resource.customer_name, topic, payload) // topic = topics.monitor.execution

    next()
  }

  server.get(
    '/:customer/resource',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.ensurePermissions(),
    router.dbFilter(),
    resources_fetch
  )

  server.get(
    '/:customer/resource/:resource',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'resource', required: true }),
    router.ensureAllowed({ entity: { name: 'resource' } }),
    router.requireCredential('viewer'),
    resources_fetch_by_id
  )

  server.patch(
    '/:customer/resource/:resource/state',
    middlewares,
    update_state,
    execution_logger,
    audit.afterUpdate('resource', { display: 'name', topic: crudTopic })
  )

  //
  // KEEP BACKWARD COMPATIBILITY WITH OLDER AGENT VERSIONS.
  // SUPPORTED FROM VERSION v0.9.3-beta-11-g8d1a93b
  //
  server.put(
    '/:customer/resource/:resource',
    middlewares,
    update_state,
    execution_logger,
    audit.afterReplace('resource', { display: 'name', topic: crudTopic })
  )
}

/**
 *
 * @author Facugon
 * @method PATCH
 * @route /:customer/resource/:id/state
 *
 */
const update_state = (req, res, next) => {
  const resource = req.resource
  const input = req.body

  logger.log(`monitor "${resource.name}(${resource._id})" state update`)
  logger.data(input)

  const manager = new App.resource(resource)
  manager
    .handleState(input)
    .catch(err => {
      logger.error(err)
    })

  res.send(200, resource)
  next()
}

/**
 *
 * @method GET
 *
 */
const resources_fetch = (req, res, next) => {
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
}

const resources_fetch_by_id = (req, res, next) => {
  const resource = req.resource
  resource.populate('monitor', err => {
    res.send(200, resource)
  })
}
