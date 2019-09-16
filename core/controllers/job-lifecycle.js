'use strict'

const App = require('../app')
const logger = require('../lib/logger')('controller:job-lifecycle')
const router = require('../router')
const LifecycleConstants = require('../constants/lifecycle')
const StateConstants = require('../constants/states')

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

  const isApproverMiddleware = () => {
    return (req, res, next) => {
      const approver_id = req.body.web_user_id
      const job = req.job

      let approver = job.task.approvers.find(_id => _id.toString() === approver_id)

      if (!approver) {
        return res.send(403, 'you are not an approver of this job')
      }
      return next()
    }
  }

  server.put(
    '/job/:job/approve',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    isApproverMiddleware(),
    controller.approve
  )

  server.put(
    '/job/:job/reject',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    isApproverMiddleware(),
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

      return res.send(204)
    })
  },
  approve (req, res, next) {
    const payload = req.body.result || {}
    const job = req.job

    App.jobDispatcher.finish({
      result: payload.data,
      state: StateConstants.SUCCESS,
      job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(204)
      next()
    })
  },
  reject (req, res, next) {
    const payload = req.body.result || {}
    const job = req.job

    App.jobDispatcher.finish({
      result: payload.data,
      state: StateConstants.FAILURE,
      job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(204)
      next()
    })
  }
}
