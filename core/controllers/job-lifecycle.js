'use strict'

const App = require('../app')
const logger = require('../lib/logger')('controller:job-lifecycle')
const router = require('../router')
const LifecycleConstants = require('../constants/lifecycle')

/**
 * @summary Job.lifecycle property CRUD
 * @namespace Controller
 * @module Job:Lifecycle
 */
module.exports = (server, passport) => {
  const middlewares = [
    passport.authenticate('bearer', {session: false}),
    router.resolve.customerNameToEntity({required: true}),
    router.ensureCustomer
  ]

  // obtain job current lifecycle
  server.get(
    '/:customer/job/:job/lifecycle',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param: 'job', required: true})
    ),
    controller.get
  )

  server.put(
    '/:customer/job/:job/cancel',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param: 'job', required: true})
    ),
    controller.cancel
  )

  server.put(
    '/job/:job/approve',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param: 'job', required: true})
    ),
    controller.approve
  )

  server.put(
    '/job/:job/reject',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param: 'job', required: true})
    ),
    controller.reject
  )
}

const controller = {
  get (req, res, next) {
    res.send(200, req.job.lifecycle)
  },
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
  },
  approve (req, res, next) {
    var result = req.params.result || {}
    App.jobDispatcher.finish({
      result,
      job: req.job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(200, req.job)
      next()
    })
  },
  reject (req, res, next) {
    var result = req.params.result || {}
    App.jobDispatcher.finish({
      result,
      job: req.job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(200, req.job)
      next()
    })
  }
}
