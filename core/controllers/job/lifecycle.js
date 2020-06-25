const App = require('../../app')
const logger = require('../../lib/logger')('controller:job-lifecycle')
const router = require('../../router')
const StateConstants = require('../../constants/states')
const JobConstants = require('../../constants/jobs')

/**
 * @summary Job.lifecycle property CRUD
 * @namespace Controller
 * @module Job:Lifecycle
 */
module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required: true}),
    router.ensureCustomer
  ]

  // obtain job current lifecycle
  server.get(
    '/:customer/job/:job/lifecycle',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param: 'job', required: true}),
    controller.get
  )

  server.put(
    '/:customer/job/:job/cancel',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param: 'job', required: true}),
    controller.cancel
  )

  const verifyApprovalMiddleware = (req, res, next) => {
    const approver_id = req.query.web_user_id
    const job = req.job

    if (job._type !== JobConstants.APPROVAL_TYPE) {
      return res.send(400, 'unexpected job type. only Approvals')
    }

    let approver = job.task.approvers.find(_id => _id.toString() === approver_id)

    if (!approver) {
      return res.send(403, 'unauthorized approver')
    }

    if (job.lifecycle !== 'onhold') {
      return res.send(409, 'approval request no longer available')
    }

    return next()
  }

  server.put(
    '/:customer/job/:job/approve',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    verifyApprovalMiddleware,
    controller.approve
  )

  server.put(
    '/:customer/job/:job/reject',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    verifyApprovalMiddleware,
    controller.reject
  )

  const verifyInputMiddleware = (req, res, next) => {
    const job = req.job
    const inputJob = [
      JobConstants.DUMMY_TYPE,
      JobConstants.SCRIPT_TYPE
    ]

    if (inputJob.indexOf(job._type) === -1) {
      return res.send(400, 'job type not allowed')
    }

    return next()
  }

  server.put(
    '/:customer/job/:job/input',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    verifyInputMiddleware,
    controller.submitInput
  )
}

const controller = {
  get (req, res, next) {
    res.send(200, req.job.lifecycle)
  },
  cancel (req, res, next) {
    const job = req.job
    const user = req.user

    App.jobDispatcher.cancel({
      result: {
        user: { email: user.email, id: user.id },
      },
      job,
      user: req.user,
      customer: req.customer
    }, err => {
      if (err) {
        logger.error('Failed to cancel job')
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      return res.send(204)
    })
  },
  approve (req, res, next) {
    const job = req.job
    const user = req.user

    App.jobDispatcher.finish({
      result: {
        user: { email: user.email, id: user.id },
        output: job.task_arguments_values
      },
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
    const job = req.job
    const user = req.user

    App.jobDispatcher.finish({
      result: {
        user: { email: user.email, id: user.id },
        output: job.task_arguments_values
      },
      state: StateConstants.FAILURE,
      job,
      user,
      customer: req.customer
    }, err => {
      if (err) { return res.send(500) }
      res.send(204)
      next()
    })
  },
  async submitInput (req, res, next) {
    const job = req.job

    try {
      if (job._type === JobConstants.DUMMY_TYPE) {
        await submitDummyInputs(req)
      }
      else if (job._type === JobConstants.SCRIPT_TYPE) {
        await submitJobInputs(req)
      }
      res.send(200, job)
      return next()
    } catch (err) {
      if (err.statusCode) {
        return res.send(err.statusCode, err.message)
      }
      return res.send(500, err.message)
    }
  }
}

const submitJobInputs = (req) => {
  const args = (req.body.args || [])
  const job = req.job
  return new Promise((resolve, reject) => {
    App.jobDispatcher.jobInputsReplenish(job, {
      task: job.task,
      task_arguments_values: args,
      user: req.user,
      customer: req.customer
    }, (err) => {
      if (err) reject(err)
      else resolve(job)
    })
  })
}

const submitDummyInputs = (req) => {
  const args = (req.body.args || [])
  const job = req.job
  return App.jobDispatcher.finishDummyJob(job, {
    task: job.task,
    task_arguments_values: args,
    user: req.user,
    customer: req.customer
  })
}
