const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
const dbFilter = require('../../lib/db-filter')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const Job = require('../../entity/job').Job
const jobArgumentsValidateMiddleware = require('../../service/job/arguments-validation')
const { ClientError } = require('../../lib/error-handler')

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
      res.send(400, err.message)
    }
  }

  // create a new workflow-job instance
  server.post('/workflows/:workflow/job',
    middlewares,
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
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.resolve.idToEntity({ param: 'task' }),
    router.ensureCustomerBelongs('workflow'),
    router.requireSecret('workflow'),
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
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
        return res.send(500, err)
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

        if (!job.workflow_id || job.workflow_id.toString() !== workflow._id.toString()) {
          throw new ClientError('Job does not belong to the Workflow')
        }

        const filter = dbFilter({})
        filter.where.workflow_job_id = job._id.toString()
        filter.where.customer_id = customer._id.toString()
        filter.where.workflow_id = workflow._id.toString()

        const jobs = await new Promise( (resolve, reject) => {
          App.Models.Job.Job.fetchBy(filter, (err, jobs) => {
            if (err) reject(err)
            else resolve(jobs)
          })
        })

        res.send(200, jobs.map(job => job.publish()))
        next()
      } catch (err) {
        return res.send(500, err)
      }
    }
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
    controller.updateAcl
  )
}

const controller = {
  async updateAcl (req, res, next) {
    try {
      const job = req.job
      const search = req.body

      if (job._type !== JobConstants.WORKFLOW_TYPE) {
        throw new ClientError('parent workflow job required')
      }

      if (!Array.isArray(search) || search.length === 0) {
        throw new ClientError('invalid body payload format')
      }

      const userPromise = []
      for (let value of search) {
        if (typeof value !== 'string') {
          throw new ClientError(`invalid body payload format. wrong value ${value}`)
        }
      }

      const users = await App.gateway.user.fetch(search, { customer_id: req.customer.id })
      if (!users || users.length === 0) {
        throw new ClientError('invalid members')
      }

      const acl = users.map(user => user.email)

      App.jobDispatcher.updateWorkflowJobsAcls(job, acl)

      job.acl = acl
      await job.save()
      res.send(200, job.acl)
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
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
      logger.error(err)
      res.send(err.status, err.message)
    }
  },
  async create (req, res, next) {
    try {
      const { workflow, user, customer, task } = req
      const args = jobArgumentsValidateMiddleware(req)

      const wJob = await App.jobDispatcher.createByWorkflow({
        task,
        workflow,
        user,
        customer,
        notify: true,
        task_arguments_values: args,
        origin: (req.origin || JobConstants.ORIGIN_USER)
      })

      let data = wJob.publish()
      data.user = {
        id: user.id,
        username: user.username,
        email: user.email
      }

      res.send(200, data)
      req.job = wJob
      next()
    } catch (err) {
      if (err.name === 'ClientError') {
        return res.send(err.status, err.message)
      }

      logger.error('%o', err)
      return res.send(500, 'Internal Server Error')
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
