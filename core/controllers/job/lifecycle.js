const App = require('../../app')
const logger = require('../../lib/logger')('controller:job-lifecycle')
const router = require('../../router')
const StateConstants = require('../../constants/states')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const argumentsValidateMiddleware = require('../../service/job/arguments-validation')
const { ClientError } = require('../../lib/error-handler')

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

  const verifyApprovalMiddleware = (req, res, next) => {
    const approver_id = req.user.id
    const job = req.job

    if (job._type !== JobConstants.APPROVAL_TYPE) {
      return res.send(400, 'unexpected job type. only Approvals')
    }

    let approver = job.approvers.find(_id => _id.toString() === approver_id)

    if (!approver) {
      return res.send(403, 'unauthorized approver')
    }

    if (job.lifecycle !== LifecycleConstants.ONHOLD) {
      return res.send(409, 'approval request no longer available')
    }

    return next()
  }

  // obtain job current lifecycle
  server.get(
    '/:customer/job/:job/lifecycle',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param: 'job', required: true}),
    router.ensureAllowed({ entity: { name: 'job' } }),
    controller.get
  )

  server.put('/job/:job/synced',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    async (req, res, next) => {
      try {
        const job = req.job
        if (job.lifecycle !== LifecycleConstants.SYNCING) {
          res.send(400, `job lifecycle must be syncing. ${job.lifecycle} is set`)
          return
        }

        await App.jobDispatcher.syncingToReady(job)
        res.send(200, "ok")
      } catch (err) {
        logger.error(err)
        res.send(500, 'Internal Server Error')
      }
    }
  )

  server.put('/:customer/job/:job/cancel',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    (req, res, next) => {
      try {
        const job = req.job
        if (job.task && job.task.cancellable === false) {
          throw new ClientError('Job is not cancellable', {statusCode: 403})
        }
        return next()
      } catch (err) {
        res.send(err.statusCode, err.message)
      }
    },
    controller.cancel
  )

  server.put('/:customer/job/:job/approve',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    verifyApprovalMiddleware,
    controller.approve
  )

  server.put('/:customer/job/:job/reject',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    verifyApprovalMiddleware,
    controller.reject
  )

  server.put('/:customer/job/:job/input',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    // verify input job
    (req, res, next) => {
      const job = req.job
      const inputJob = [
        JobConstants.DUMMY_TYPE,
        JobConstants.SCRIPT_TYPE
      ]

      if (inputJob.indexOf(job._type) === -1) {
        return res.send(400, 'job type not allowed. script and dummy')
      }

      if (
        JobConstants.SCRIPT_TYPE === job._type && 
        job.lifecycle !== LifecycleConstants.ONHOLD
      ) {
        return res.send(400, 'only on hold jobs allowed')
      }

      return next()
    },
    controller.submitInput
  )

  server.put('/:customer/job/:job/restart',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    // verify input job
    (req, res, next) => {
      try {
        const job = req.job

        if (!job.isCompleted()) {
          throw new ClientError('Only completed jobs allowed')
        }

        if (job._type !== JobConstants.SCRIPT_TYPE) {
          throw new ClientError('Only script tasks allowed')
        }

        return next()
      } catch (err) {
        logger.error(err)
        res.send(err.status, err.message)
      }
    },
    async (req, res, next) => {
      try {
        const job = req.job
        const task = job.task
        const args = argumentsValidateMiddleware( Object.assign({}, req, { task }) )

        await App.jobDispatcher.restart({
          user: req.user,
          customer: req.customer,
          job,
          task_arguments_values: ( args || [] )
        })
        res.send(200, job)
      } catch (err) {
        logger.error(err)
        res.send(500, 'Internal Server Error')
      }
    }
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
        user: {
          email: user.email,
          id: user.id,
          username: user.username
        },
      },
      job,
      user: req.user,
      customer: req.customer
    }, (err) => {
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
        user: {
          email: user.email,
          id: user.id,
          username: user.username
        },
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
        user: {
          email: user.email,
          id: user.id,
          username: user.username
        },
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
      logger.error(err)
      if (err.statusCode) {
        return res.send(err.statusCode, err.message)
      }
      return res.send(500, err.message)
    }
  }
}

/**
 *
 * @return {Promise<Job>}
 *
 */
const submitJobInputs = (req) => {
  const args = (req.body && req.body.args)
  const job = req.job
  return App.jobDispatcher.jobInputsReplenish({
    job,
    task: job.task,
    task_arguments_values: (args || []),
    user: req.user,
    customer: req.customer
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
