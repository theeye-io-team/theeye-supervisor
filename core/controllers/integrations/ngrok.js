const App = require('../../app')
const logger = require('../../lib/logger')('controller:integrations:ngrok')
const router = require('../../router')
const Host = require('../../entity/host').Entity
const merge = require('lodash/merge')
const IntegrationConstants = require('../../constants/integrations')

module.exports = (server) => {

  server.get(
    '/integrations/ngrok',
    [
      server.auth.bearerMiddleware,
      router.requireCredential('admin'),
      router.resolve.customerNameToEntity({ required:true }),
      router.ensureCustomer,
      router.resolve.idToEntity({ param: 'host', required: true })
    ],
    controller.get
  )

  server.put(
    '/integrations/ngrok/start',
    [
      server.auth.bearerMiddleware,
      router.requireCredential('admin'),
      router.resolve.customerNameToEntity({ required:true }),
      router.ensureCustomer,
      router.ensureHeader('content-type','application/json'), // should receive the req.body with an object
      router.resolve.idToEntity({ param: 'host', required: true })
    ],
    controller.start,
    postCreateNgrokIntegrationJob
  )

  server.put(
    '/integrations/ngrok/stop',
    [
      server.auth.bearerMiddleware,
      router.requireCredential('admin'),
      router.resolve.customerNameToEntity({ required:true }),
      router.ensureCustomer,
      router.ensureHeader('content-type','application/json'), // should receive the req.body with an object
      router.resolve.idToEntity({ param: 'host', required: true })
    ],
    controller.stop,
    postCreateNgrokIntegrationJob
  )

}

const controller = {
  get (req, res, next) {
    const customer = req.customer
    const host = req.host
    res.send(200, host.integrations.ngrok || {})
    next()
  },
  /**
   *
   * @summary start ngrok integration
   *
   */
  start (req, res, next) {
    const customer = req.customer
    const host = req.host

    let ngrok = host.integrations.ngrok || { active: false }
    if (ngrok.active === true) {
      return res.send(400, 'already started')
    }

    let config = merge({}, customer.config.ngrok)
    startNgrok({ host, config }, (err, job) => {
      if (err) return res.send(err.statusCode||500, err.message)
      delete job.authtoken
      res.send(202, job)
      req.job = job
      next()
    })
  },
  stop (req, res, next) {
    const customer = req.customer
    const host = req.host

    let ngrok = host.integrations.ngrok || { active: false }
    if (ngrok.active === false) {
      return res.send(400, 'already stopped')
    }

    let config = merge({}, customer.config.ngrok)
    stopNgrok({ host, config }, (err, job) => {
      if (err) return res.send(err.statusCode||500, err.message)
      delete job.authtoken
      res.send(202, job)
      req.job = job
      next()
    })
  }
}

/**
 * @summary Start ngrok tunnel on the host
 * @param {Host} options a Host instance
 * @property {Host} options.host a Host instance
 * @property {Object} options.config host ngrok configuration
 */
const startNgrok = ({ host, config }, next) => {
  // .. validate and do things...
  let orders = {
    integration: IntegrationConstants.NGROK,
    operation: IntegrationConstants.OPERATION_START,
    host,
    config
  }
  App.jobDispatcher.createIntegrationJob(orders, next)
}

const stopNgrok = ({ host, config }, next) => {
  let orders = {
    integration: IntegrationConstants.NGROK,
    operation: IntegrationConstants.OPERATION_STOP,
    host,
    config
  }
  App.jobDispatcher.createIntegrationJob(orders, next)
}

const postCreateNgrokIntegrationJob = (req, res, next) => {
  const job = req.job
  const host = req.host

  let ngrok = host.integrations.ngrok
  ngrok.last_job = job._id
  ngrok.last_job_id = job._id
  ngrok.last_update = new Date()
  let integrations = merge({}, host.integrations, { ngrok })
  Host.update(
    { _id: host._id },
    {
      $set: { integrations: integrations.toObject() }
    },
    (err) => {
      if (err) logger.error('%o', err)
      next()
    }
  )
}
