'use strict'

const App = require('../app')
const debug = require('../lib/logger')('controller:job-lifecycle')
const router = require('../router')
const LifecycleConstants = require('../constants/lifecycle')

/**
 * @summary Job.lifecycle property CRUD
 * @namespace Controller
 * @module Job:Lifecycle
 */
module.exports = (server, passport) => {
  const middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  // obtain job current lifecycle
  server.get(
    '/:customer/job/:job/lifecycle',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'job',required:true})
    ),
    controller.get
  )

  //server.put(
  //  '/:customer/job/:job/lifecycle/:lifecycle', 
  //  middlewares.concat(
  //    router.requireCredential('user'),
  //    router.resolve.idToEntity({param:'job',required:true})
  //  ),
  //  controller.update
  //)

  server.put(
    '/:customer/job/:job/cancel',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'job',required:true})
    ),
    controller.cancel
  )
}

const controller = {
  get (req, res, next) {
    res.send(200, req.job.lifecycle)
  },
  //update (req, res, next) {
  //  const job = req.job
  //  const user = req.user
  //  const customer = req.customer
  //  const lifecycle = req.params.lifecycle

  //  if (!lifecycle) {
  //    return res.send(400, 'lifecycle value is required')
  //  }
  //  if (LifecycleConstants.VALUES.indexOf(lifecycle)===-1) {
  //    return res.send(400, 'invalid lifecycle value')
  //  }

  //  let data = { job, user, customer, lifecycle, state: 'unknown' }
  //  App.jobDispatcher.update(data, err => {
  //    if (err) {
  //      logger.error('Failed to update job lifecycle')
  //      logger.error(err)
  //      return res.send(500)
  //    }

  //    return res.send(200, job.lifecycle)
  //  })
  //},
  cancel (req, res, next) {
    const job = req.job
    App.jobDispatcher.cancel({ job, user: req.user, customer: req.customer }, err => {
      if (err) {
        logger.error('Failed to cancel job')
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      return res.send(200, job.lifecycle)
    })
  }
}
