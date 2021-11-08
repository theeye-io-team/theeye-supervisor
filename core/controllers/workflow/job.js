const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
const dbFilter = require('../../lib/db-filter')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const Job = require('../../entity/job').Job
const jobPayloadValidationMiddleware = require('../../service/job//payload-validation')
const { ClientError } = require('../../lib/error-handler')
const ACL = require('../../lib/acl')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  const verifyStartingTask = async (req, res, next) => {
    try {
      if (!req.task) {
        const { workflow } = req
        const taskId = workflow.start_task_id
        const task = await App.Models.Task.Task.findById(taskId)
        if (!task) {
          throw new Error('workflow first task not found')
        }
        req.task = task
      }
      return next()
    } catch (err) {
      res.sendError(err)
    }
  }

  // create a new workflow-job instance
  server.post('/workflows/:workflow/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.resolve.idToEntity({ param: 'task' }),
    router.ensureCustomerBelongs('workflow'),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    verifyStartingTask,
    controller.create
  )

  // create job using task secret key
  server.post('/workflows/:workflow/secret/:secret/job',
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.resolve.idToEntity({ param: 'task' }),
    router.requireSecret('workflow'),
    (req, res, next) => {
      req.workflow
        .populate('customer')
        .execPopulate()
        .then(() => {
          req.customer = req.workflow.customer
          req.user = App.user
          req.origin = JobConstants.ORIGIN_SECRET
          next()
        })
        .catch(err => {
          res.sendError(err)
        })
    },
    verifyStartingTask,
    controller.create
  )

  server.del('/workflows/:workflow/job',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureCustomerBelongs('workflow'),
    controller.remove
  )

  server.get('/workflows/:workflow/job/:job',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param: 'workflow', required: true }),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    async (req, res, next) => {
      try {
        const customer = req.customer
        const workflow = req.workflow
        const job = req.job

        if (!job.workflow_id || job.workflow_id.toString() !== workflow._id.toString()) {
          throw new ClientError('Job does not belong to the Workflow')
        }

        res.send(200, job.publish())
        next()
      } catch (err) {
        res.sendError(err)
      }
    }
  )

  /**
   * fetch many workflow job information
   */
  server.get('/workflows/:workflow/job/:job/jobs',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param: 'workflow', required: true }),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    async (req, res, next) => {
      try {
        const customer = req.customer
        const workflow = req.workflow
        const job = req.job

        if (job._type !== JobConstants.WORKFLOW_TYPE) {
          throw new ClientError('A workflow job is required')
        }

        if (!job.workflow_id || job.workflow_id.toString() !== workflow._id.toString()) {
          throw new ClientError('The job does not belong to the workflow')
        }

        const filter = dbFilter({})
        filter.where.workflow_job_id = job._id.toString()
        filter.where.customer_id = customer._id.toString()
        filter.where.workflow_id = workflow._id.toString()

        if (!ACL.hasAccessLevel(req.user.credential, 'admin')) {
          // find what this user can access
          filter.where.acl = req.user.email
        }

        const jobs = await App.Models.Job.Job.fetchBy(filter)
        res.send(200, jobs.map(job => job.publish()))
      } catch (err) {
        res.sendError(err)
      }
    }
  )

  /**
   *
   * fetch all job instances
   *
   */
  server.get('/workflows/:workflow/job',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param: 'workflow', required: true }),
    router.ensureCustomerBelongs('workflow'),
    (req, res, next) => {
      const workflow = req.workflow
      const customer = req.customer
      const user = req.user

      const filter = dbFilter(req.query, { })
      filter.where.customer_id = customer.id
      filter.where.workflow_id = workflow._id.toString()

      filter.include = Object.assign(filter.include, {
        script_arguments: 0,
        output: 0,
        result: 0,
        script: 0,
        task_arguments_values: 0, // input
        task: 0
      })

      //if (workflow.table_view !== true) {
      //  filter.include.task_arguments_values = 0
      //  filter.include.task = 0
      //}

      if (!ACL.hasAccessLevel(req.user.credential, 'admin')) {
        filter.where.acl = req.user.email
      }

      App.Models.Job.Job.fetchBy(filter)
        .then(jobs => {
          res.send(200, jobs)
          next()
        })
        .catch(res.sendError)
    }
  )

  // retrieve the inputs for all the executions
  server.get('/workflows/:workflow/jobs/input',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'workflow', required: true }),
    controller.input
  )

  server.put('/workflows/:workflow/job/:job/cancel',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.cancel
  )

  server.put('/workflows/:workflow/job/:job/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    (req, res, next) => {
      try {
        if (req.job._type !== JobConstants.WORKFLOW_TYPE) {
          throw new ClientError('A workflow job is required')
        }

        if (!Array.isArray(req.body) || req.body.length === 0) {
          throw new ClientError('Invalid body payload format')
        }

        if (req.job.allows_dynamic_settings === false) {
          throw new ClientError('Dynamic settings not allowed', { statusCode: 403 })
        }

        for (let value of req.body) {
          if (typeof value !== 'string') {
            throw new ClientError(`invalid body payload format. wrong value ${value}`)
          }
        }

        next()
      } catch (err) {
        res.sendError(err)
      }
    },
    controller.replaceAcl
  )
}

const controller = {
  async input (req, res, next) {
    const { workflow, customer, user } = req

    const filters = dbFilter(req.query, { /** default **/ })
    filters.where.customer_id = customer._id.toString()
    filters.where.workflow_id = workflow._id
    filters.where.task_id = workflow.start_task_id

    if (!ACL.hasAccessLevel(user.credential, 'admin')) {
      filters.where.acl = user.email
    }

    filters.include = Object.assign(filters.include, {
      workflow_id: 1,
      workflow_job_id: 1,
      task_arguments_values: 1,
      _type: 1,
      type: 1
    })

    if (req.query.hasOwnProperty("include_definitions")) {
      filters.include.task = 1
    }

    App.Models.Job.Job.fetchBy(filters)
      .then(jobs => {
        res.send(200, jobs)
        next()
      })
      .catch(res.sendError)
  },
  async replaceAcl (req, res, next) {
    try {
      const job = req.job

      const userPromise = []
      const users = await App.gateway.user.fetch(req.body, { customer_id: req.customer.id })
      if (!users || users.length === 0) {
        throw new ClientError('invalid members')
      }

      const acl = users.map(user => user.email)

      App.jobDispatcher.updateWorkflowJobsAcls(job, acl)

      job.acl = acl
      await job.save()
      res.send(200, job.acl)
    } catch (err) {
      res.sendError(err)
    }
  },
  async cancel (req, res, next) {
    try {
      const job = req.job

      if (job._type !== JobConstants.WORKFLOW_TYPE) {
        throw new ClientError('parent workflow job required')
      }

      await cancelWorkflowJobs(req)

      res.send(200)
    } catch (err) {
      res.sendError(err)
    }
  },
  async create (req, res, next) {
    try {
      const { user } = req
      const payload = await jobPayloadValidationMiddleware(req)
      const wJob = await App.jobDispatcher.createByWorkflow(payload)

      const data = wJob.publish()
      data.user = {
        id: user.id,
        username: user.username,
        email: user.email
      }

      res.send(200, data)
      req.job = wJob
      next()
    } catch (err) {
      res.sendError(err)
    }
  },
  remove (req, res, next) {
    const workflow = req.workflow
    const customer = req.customer
    const query = req.query || {}

    res.send(202, {})

    process.nextTick(() => {
      Job.aggregate([
        {
          $match: {
            workflow_id: workflow._id.toString(),
            customer_id: customer._id.toString()
          }
        }, {
          $group: {
            _id: '$workflow_job_id',
            tasksJobs: {
              $push: '$$ROOT'
            }
          }
        }, {
          $project: {
            //tasksJobs: 1,
            finished: {
              $allElementsTrue: {
                $map: {
                  input: '$tasksJobs',
                  as: 'taskjob',
                  in: {
                    $or: [
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.FINISHED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.TERMINATED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.CANCELED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.EXPIRED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.COMPLETED ] }
                    ]
                  }
                }
              }
            },
            _id: 1
          }
        }, {
          $match: {
            finished: true
          }
        }
      ]).exec((err, result) => {
        if (err) {
          logger.error('%o', err)
          return
        }

        for (let wfJob of result) {
          Job.deleteMany({
            $or: [
              { _id: { $eq: wfJob._id } },
              { workflow_job_id: { $eq: wfJob._id } }
            ]
          }, (err) => {
            if (err) {
              logger.error('%o', err)
            }
          })
        }
      })
    })
  }
}


/**
 * To cancel a workflow we need to cancel the last job in progress.
 *
 * @return {Promise}
 */
const cancelWorkflowJobs = ({ job, user, customer }) => {
  return new Promise((resolve, reject) => {
    App.Models.Job.Job
      .find({ workflow_job_id: job._id })
      .sort({ _id: -1 })
      .limit(1)
      .exec()
      .then(jobs => {
        if (!Array.isArray(jobs) || jobs.length === 0) {
          return reject( new Error('Workflow is not in executing') )
        }

        App.jobDispatcher.cancel({
          result: {
            user: { email: user.email, id: user.id },
          },
          job: jobs[0],
          user,
          customer
        }, err => {
          if (err) { reject(err) }
          else {
            job.lifecycle = LifecycleConstants.TERMINATED
            job.state = LifecycleConstants.CANCELED
            job.save().then(resolve).catch(reject)
          }
        })
      })
      .catch(reject)
  })
}
