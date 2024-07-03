const graphlib = require('graphlib')
const App = require('../../app')
const router = require('../../router')
const { ClientError, ServerError } = require('../../lib/error-handler')
const audit = require('../../lib/audit')
const logger = require('../../lib/logger')('controller:workflow:acl')

module.exports = (server) => {

  /** 
  * @openapi
  * /workflows/{workflow}/acl:
  *   get:
  *     summary: Get workflow acls
  *     description: Get a list of acls from workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/workflows/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.get
  )

  /** 
  * @openapi
  * /workflows/{workflow}/acl:
  *   put:
  *     summary: Replace workflow acls
  *     description: Replace acls from workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully replaced workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.put('/workflows/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.replace,
    audit.afterUpdate('workflow', { display: 'name' })
  )

  /** 
  * @openapi
  * /workflows/{workflow}/acl:
  *   patch:
  *     summary: Update workflow acls
  *     description: Update acls from workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.patch('/workflows/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.update,
    audit.afterUpdate('workflow', { display: 'name' })
  )

  /** 
  * @openapi
  * /workflows/{workflow}/acl:
  *   delete:
  *     summary: Delete workflow acls
  *     description: Delete acls from workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully deleted workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.del('/workflows/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.del,
    audit.afterUpdate('workflow', { display: 'name' })
  )

}

const controller = {

  async get (req, res) {
    const workflow = req.workflow
    const { acl } = workflow
    res.send(200, { acl })
  },
  async replace (req, res) {
    try {
      const workflow = req.workflow

      const body = req.body || {}
      const query = req.query || {}
      const users = (body.users || query.users)

      if ( ! Array.isArray(users) ) {
        throw new ClientError('Invalid acl format')
      }

      let acl
      if (users.length === 0) {
        acl = []
      } else {
        for (let value of users) {
          if (typeof value !== 'string') {
            throw new ClientError(`Invalid acl format. Value ${value} must be string`)
          }
        }

        const members = await App.gateway.user.fetch(users, { customer_id: req.customer.id })
        if (!members || members.length === 0) {
          throw new ClientError('Invalid members')
        }

        acl = members.map(user => user.email)
      }

      workflow.acl = acl
      await workflow.save()
      await assignWorkflowAclToTasks(workflow)
      res.send(200, { acl: workflow.acl })
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async update (req, res) {
    try {
      const workflow = req.workflow

      const body = req.body || {}
      const query = req.query || {}
      const users = (body.users || query.users)
      const action = (body.action || query.action) // add or remove

      if ( ! Array.isArray(users) || users.length === 0 ) {
        throw new ClientError('Invalid users format')
      }

      if (!action || (action !== 'add' && action !== 'remove')) {
        throw new ClientError('Invalid action. Tell "add" or "remove"')
      }

      let acl
      if (action === 'add') {
        for (let value of users) {
          if (typeof value !== 'string') {
            throw new ClientError(`Invalid users format. Value ${value} must be string`)
          }
        }

        const members = await App.gateway.user.fetch(users, { customer_id: req.customer.id })
        if (!members || members.length === 0) {
          throw new ClientError('Invalid members')
        }

        emails = members.map(member => member.email)
        for (let email of emails) {
          if (workflow.acl.indexOf(email) === -1) {
            workflow.acl.push(email)
          }
        }
      } else { //remove
        acl = workflow.acl

        const members = await App.gateway.user.fetch(users, { customer_id: req.customer.id })
        if (!members || members.length === 0) {
          throw new ClientError('Invalid members')
        }

        for (let member of members) {
          let index = acl.indexOf(member.email)
          if (index !== -1) {
            acl.splice(index, 1)
          }
        }

        workflow.acl = acl
      }

      await workflow.save()
      await assignWorkflowAclToTasks(workflow)
      res.send(200, { acl: workflow.acl })
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async del (req, res) {
    try {
      const workflow = req.workflow
      workflow.acl = []
      await workflow.save()
      await assignWorkflowAclToTasks(workflow)
      res.send(200, { acl: workflow.acl })
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  }
}

const assignWorkflowAclToTasks = async (workflow) => {
  const graph = graphlib.json.read(workflow.graph)
  const nodes = graph.nodes()
  for (let id of nodes) {
    let node = graph.node(id)
    if (/Task/.test(node._type)) {
      await new Promise( (resolve, reject) => {
        App.task.assignWorkflowAclToTask(id, workflow, err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  }
}
