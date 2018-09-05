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
    const web_user_id = req.body.web_user_id

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
    const result = req.body.result || {}
    const web_user_id = req.body.web_user_id
    const job = req.job

    result.state = StateConstants.SUCCESS

    if (!isApprover(job.task.approvers, web_user_id)) {
      return res.send(403, 'you are not allowed to approve this job')
    }

    App.jobDispatcher.finish({
      result,
      job: req.job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(204)
      next()
    })
  },
  reject (req, res, next) {
    const result = req.body.result || {}
    const web_user_id = req.body.web_user_id
    const job = req.job

    result.state = StateConstants.FAILURE

    if (!isApprover(job.task.approvers, web_user_id)) {
      return res.send(403, 'you are not allowed to approve this job')
    }

    App.jobDispatcher.finish({
      result,
      job: req.job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(204)
      next()
    })
  }
}

const isApprover = (approvers, approver_id) => {
  return approvers.find( _id => {
    return _id.toString() === approver_id
  })
}
