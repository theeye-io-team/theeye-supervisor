const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:integrations');
const router = require('../../router');
const TaskConstants = require('../../constants')

module.exports = (server) => {

  /** 
  * @openapi
  * /{customer}/task/{task}/credentials:
  *   get:
  *     summary: Get task credentials
  *     description: Get credentials from specific task.
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

  server.get(
    '/:customer/task/:task/credentials',
    [
      server.auth.bearerMiddleware,
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.ensureAllowed({ entity: { name: 'task' } })
    ],
    controller.credentials
  )
}

const controller = {
  /**
   * @summary get task credentials
   * @param {Mixed} task instance or id
   * @param {Function} next
   */
  credentials (req, res, next) {
    let task = req.task

    res.send(200, { id: task._id, secret: task.secret })
  }
}
