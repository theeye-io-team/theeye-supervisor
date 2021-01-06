const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
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

  /**
   * fetch many jobs information
   */
  server.get('/workflows/:workflow/job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    controller.fetch
  )

  server.put('/workflows/:workflow/job/:job/cancel',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.cancel
  )
}

const controller = {
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
  },
  fetch (req, res, next) {
    throw new Error('in progress !!!')

    const customer = req.customer
    const user = req.user
    const query = req.query

    logger.log('querying jobs')

    const filter = dbFilter(query, { /** default **/ })
    filter.where.customer_id = customer._id.toString()
    filter.populate = 'user'

    Job.fetchBy(filter, (err, jobs) => {
      if (err) { return res.send(500, err) }
      let data = []
      jobs.forEach(job => data.push(job.publish()))
      res.send(200, data)
      next()
    })
  },
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
