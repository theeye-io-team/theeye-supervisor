const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:monitor:runner')

module.exports = (server) => {
  server.get('/monitor/runner',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    // router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'host', required: true }),
    fetch
  )

  // create job runner
  server.post('/monitor/runner',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    // router.resolve.customerNameToEntity({ required: true }),
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    create
  )

  // remove runner
  server.del('/monitor/runner/:monitor',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    // router.resolve.customerNameToEntity({ required: true }),
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
const create = async (req, res) => {
  try {
    const { customer, host, task } = req
    // default values.
    const {
      looptime = 10000,
      name = `${host.hostname}-listener`,
      description = 'Extra queue',
      multitasking = true,
      multitasking_limit = 1
    } = req.body

    const payload = {
      enable: true,
      type: 'listener', // sub-type
      _type: 'ResourceMonitor',
      customer_name: customer.name,
      customer: customer._id,
      customer_id: customer._id,
      host: host._id,
      host_id: host._id.toString(),
      order: 0,
      name,
      looptime,
      description,
      config: {
        multitasking,
        multitasking_limit, // add limit count to jobs queue query
        task_id: task._id // bind the listener to a single task queue
      }
    }

    // use insert to avoid schema validations
    const inserted = await App.Models.Monitor.Monitor.collection.insert(payload)

    App.jobDispatcher.createAgentUpdateJob(host._id)

    res.send(200, inserted.ops[0])
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const fetch = async (req, res) => {
  try {
    const host = req.host
    const customer = req.customer

    const runners = await App.Models.Monitor.Monitor.find({
      type: 'listener',
      customer: customer._id,
      host: host._id
    })

    res.send(200, runners)
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const remove = async (req, res) => {
  try {
    const monitor = req.monitor
    await monitor.remove()
    res.send(204)
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}
