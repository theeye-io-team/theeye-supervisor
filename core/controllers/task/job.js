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

  /** 
  * @openapi
  * /task/{task}/job/queue:
  *   get:
  *     summary: Get task's job queue
  *     description: Get job queue from specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved task information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/task/:task/job/queue',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    queueController
  )

  /** 
  * @openapi
  * /{customer}/task/{task}/job:
  *   delete:
  *     summary: Delete task jobs
  *     description: Delete jobs from specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully deleted jobs.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.del('/:customer/task/:task/job',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureCustomerBelongs('task'),
    remove
  )

  /** 
  * @openapi
  * /{customer}/task/{task}/job:
  *   post:
  *     summary: Start task
  *     description: Start a specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully created task job.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

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

  /** 
  * @openapi
  * /task/{task}/job:
  *   post:
  *     summary: Start task
  *     description: Start a specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully started task.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.post('/task/:task/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.requireCredential('user'),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  /** 
  * @openapi
  * /{customer}/task/{task}/secret/{secret}/job:
  *   post:
  *     summary: Start task with key
  *     description: Start a specific task with secret key.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Key
  *         in: query
  *         description: Secret key
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully started task.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

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

  /** 
  * @openapi
  * /task/{task}/secret/{secret}/job:
  *   post:
  *     summary: Start task with key
  *     description: Start a specific task with secret key.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Key
  *         in: query
  *         description: Secret key
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully started task.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

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
