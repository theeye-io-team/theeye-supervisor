const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:task:job')
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const createJob = require('../../service/job/create')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {

  /**
   * fetch many jobs information
   */
  server.get('/task/:task/job/queue',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    queueController
  )

  server.del('/:customer/task/:task/job',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureCustomerBelongs('task'),
    remove
  )

  server.post('/:customer/task/:task/job',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  //
  // new version
  //
  server.post('/task/:task/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.requireCredential('user'),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  server.post('/:customer/task/:task/secret/:secret/job',
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.requireSecret('task'),
    (req, res, next) => {
      req.task
        .populate('customer')
        .execPopulate()
        .then(() => {
          req.customer = req.task.customer
          req.user = App.user
          req.origin = JobConstants.ORIGIN_SECRET
          next()
        })
        .catch(err => {
          res.sendError(err)
        })
    },
    createJob
  )

  server.post('/task/:task/secret/:secret/job',
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.requireSecret('task'),
    (req, res, next) => {
      req.task
        .populate('customer')
        .execPopulate()
        .then(() => {
          req.customer = req.task.customer
          req.user = App.user
          req.origin = JobConstants.ORIGIN_SECRET
          next()
        })
        .catch(err => {
          res.sendError(err)
        })
    },
    createJob
  )
}

const queueController = async (req, res) => {
  try {
    const { customer, user, task } = req
    const query = req.query

    if (query.limit && isNaN(query.limit)) {
      throw new ClientError('Invalid limit value')
    }
    const limit = ( Number(query.limit) || 1)

    const jobs = await App.jobDispatcher.getJobsByTask({
      customer,
      //host,
      task,
      limit
    })

    for (let job of jobs) {
      App.scheduler.scheduleJobTimeoutVerification(job)
    }

    res.send(200, jobs)
  } catch (err) {
    res.sendError(err)
  }
}

const remove = async (req, res) => {
  try {
    const task = req.task
    const customer = req.customer
    const querystring = req.query || {}

    let dbquery = {
      customer_id: customer._id.toString(),
      task_id: task._id.toString(),
      $or: [
        { lifecycle: LifecycleConstants.FINISHED },
        { lifecycle: LifecycleConstants.TERMINATED },
        { lifecycle: LifecycleConstants.CANCELED },
        { lifecycle: LifecycleConstants.EXPIRED },
        { lifecycle: LifecycleConstants.COMPLETED }
      ]
    }

    if (querystring.lifecycle) {
      if (Array.isArray(querystring.lifecycle)) {
        querystring.lifecycle.forEach(lifecycle => {
          if (LifecycleConstants.VALUES.indexOf(lifecycle) !== -1) {
            dbquery["$or"].push({ lifecycle })
          }
        })
      }
    }

    let result = await App.Models.Job.Job.deleteMany(dbquery)
    res.send(200, { deletedCount: result.deletedCount })
  } catch (err) {
    res.sendError(500)
  }
}
