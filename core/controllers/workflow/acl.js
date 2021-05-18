const graphlib = require('graphlib')
const App = require('../../app')
const router = require('../../router')
const { ClientError, ServerError } = require('../../lib/error-handler')
const audit = require('../../lib/audit')
const logger = require('../../lib/logger')('controller:workflow:acl')

module.exports = (server) => {

  server.get('/workflow/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.get
  )

  server.put('/workflow/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.replace,
    audit.afterUpdate('workflow', { display: 'name' })
  )

  server.patch('/workflow/:workflow/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.update,
    audit.afterUpdate('workflow', { display: 'name' })
  )

  server.del('/workflow/:workflow/acl',
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

  async get (req, res, next) {
    const workflow = req.workflow
    const { acl } = workflow
    res.send(200, { acl })
  },
  async replace (req, res, next) {
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
      next()
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async update (req, res, next) {
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
      next()
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async del (req, res, next) {
    try {
      const workflow = req.workflow
      workflow.acl = []
      await workflow.save()
      await assignWorkflowAclToTasks(workflow)
      res.send(200, { acl: workflow.acl })
      next()
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
    if (!/Event/.test(node._type)) {
      await new Promise( (resolve, reject) => {
        App.task.assignWorkflowAclToTask(id, workflow, err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  }
}
