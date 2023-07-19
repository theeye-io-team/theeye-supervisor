const App = require('../../app')
const restify = require('restify')
const createJob = require('../../service/job/create')
const router = require('../../router')
const JobConstants = require('../../constants/jobs')

module.exports = (server) => {

  /** 
  * @openapi
  * /{customer}/job:
  *   post:
  *     summary: Create a new job.
  *     description: Creates a new job by customer name.
  *     tags:
  *       - Job
  *     parameters:
  *     - name: customer
  *       in: query
  *       description: customer name
  *       required: true
  *       schema:
  *         type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Job'
  *     responses:
  *       '201':
  *         description: Successfully created a new job.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Job'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/:customer/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensurePermissions(),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  /** 
  * @openapi
  * /job:
  *   post:
  *     summary: Create a new job.
  *     description: Creates a new job.
  *     tags:
  *       - Job
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Job'
  *     responses:
  *       '201':
  *         description: Successfully created a new job.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Job'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensurePermissions(),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
    //restify.plugins.conditionalHandler([
    //  { version: '1.0.0', handler: createJob },
    //  { version: '2.9.0', handler: createFromFiles }
    //])
  )

  // create job using task secret key

  /** 
  * @openapi
  * /job/secret/{secret}:
  *   post:
  *     summary: Create job with secret key.
  *     description: Creates a new job by secret key.
  *     tags:
  *       - Job
  *     parameters:
  *     - name: secret
  *       in: query
  *       description: scret key
  *       required: true
  *       schema:
  *         type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Job'
  *     responses:
  *       '201':
  *         description: Successfully created a new job.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Job'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/job/secret/:secret',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.requireSecret('task'),
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    createJob
  )
}
