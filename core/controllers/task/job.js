const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const createJob = require('../../service/job/create')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.post(
    '/:customer/task/:task/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  server.post(
    '/:customer/task/:task/secret/:secret/job',
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
          return res.send(500, err.message)
        })
    },
    createJob
  )

  server.post(
    '/task/:task/secret/:secret/job',
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
          return res.send(500, err.message)
        })
    },
    createJob
  )

  server.del(
    '/:customer/task/:task/job',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureCustomerBelongs('task'),
    remove
  )
}

const remove = async (req, res, next) => {
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
    return next()
  } catch (err) {
    logger.error('%o', err)
    res.send(500)
  }
}
