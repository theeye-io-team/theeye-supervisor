const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const Job = require('../../entity/job').Job

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  // create a new workflow-job instance
  server.post(
    '/workflows/:workflow/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureCustomerBelongs('workflow'),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.create
  )

  // create job using task secret key
  server.post(
    '/workflows/:workflow/secret/:secret/job',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureCustomerBelongs('workflow'),
    router.requireSecret('workflow'),
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    controller.create
  )

  server.del(
    '/workflows/:workflow/job',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureCustomerBelongs('workflow'),
    controller.remove
  )

  /**
   * fetch many jobs information
   */
  server.get(
    '/workflows/:workflow/job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    controller.fetch
  )
}

const controller = {
  create (req, res, next) {
    let { workflow, user, customer } = req
    let args = req.body.task_arguments || []

    App.jobDispatcher.createByWorkflow({
      workflow,
      user,
      customer,
      notify: true,
      task_arguments_values: args,
      origin: (req.origin || JobConstants.ORIGIN_USER)
    }, (err, job) => {
      if (err) {
        logger.error('%o', err)
        return res.send(err.statusCode || 500, err.message)
      }

      let data = job.publish()
      data.user = {
        id: user.id,
        username: user.username,
        email: user.email
      }

      res.send(200, data)
      req.job = job
      next()
    })
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
