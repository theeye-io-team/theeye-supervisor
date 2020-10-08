const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:monitor:runner')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get(
    '/monitor/runner',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    fetch
  )

  // create job runner
  server.post(
    '/monitor/runner',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    create
  )

  // remove runner
  server.del(
    '/monitor/runner/:monitor',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'monitor', required: true }),
    remove
  )
}

/**
 *
 * @method POST
 *
 */
const create = async (req, res, next) => {
  try {
    const host = req.host
    const customer = req.customer
    const body = req.body

    const payload = {
      enable : true,
      _type : 'ResourceMonitor',
      customer_name : req.customer.name,
      customer : req.customer._id,
      customer_id : req.customer._id,
      host : host._id,
      host_id : host._id.toString(),
      name : host.hostname + '-listener',
      type : 'listener',
      looptime : body.looptime || 10000,
      description : 'Extra jobs listener',
      order : 0
    }

    // use insert to skip schema validations
    const inserted = await App.Models.Monitor.Monitor.collection.insert(payload)

    App.jobDispatcher.createAgentUpdateJob(host._id)

    res.send(200, inserted.ops[0])
    next()
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const fetch = async (req, res, next) => {
  try {
    const host = req.host
    const customer = req.customer

    const runners = await App.Models.Monitor.Monitor.find({
      type: "listener",
      customer: customer._id,
      host: host._id
    })

    res.send(200, runners)
    next()
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const remove = async (req, res, next) => {
  try {
    const monitor = req.monitor
    await monitor.remove()
    res.send(204)
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}
