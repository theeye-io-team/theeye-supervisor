const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:acl')
const router = require('../../router')
const { ClientError, ServerError } = require('../../lib/error-handler')
const audit = require('../../lib/audit')

module.exports = (server) => {

  server.get('/task/:task/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.get
  )

  server.put('/task/:task/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.replace,
    audit.afterUpdate('task', { display: 'name' })
  )

  server.patch('/task/:task/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.update,
    audit.afterUpdate('task', { display: 'name' })
  )

  server.del('/task/:task/acl',
    server.auth.bearerMiddleware,
    router.requireCredential('manager'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.del,
    audit.afterUpdate('task', { display: 'name' })
  )

}

const controller = {

  async get (req, res, next) {
    const task = req.task
    res.send(200, { acl: task.acl })
  },
  async replace (req, res, next) {
    try {
      const task = req.task

      const body = req.body || {}
      const query = req.query || {}
      const payload = (body.users || query.users)

      if ( ! Array.isArray(payload) ) {
        throw new ClientError('Invalid acl format')
      }

      let acl
      if (payload.length === 0) {
        acl = []
      } else {
        for (let value of payload) {
          if (typeof value !== 'string') {
            throw new ClientError(`Invalid acl format. Value ${value} must be string`)
          }
        }

        const users = await App.gateway.user.fetch(payload, { customer_id: req.customer.id })
        if (!users || users.length === 0) {
          throw new ClientError('Invalid members')
        }

        acl = users.map(user => user.email)
      }

      task.acl = acl
      await task.save()
      res.send(200, { acl })
      next()
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async update (req, res, next) {
    try {
      const task = req.task

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
          if (task.acl.indexOf(email) === -1) {
            task.acl.push(email)
          }
        }
      } else { //remove
        acl = task.acl

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

        task.acl = acl
      }

      await task.save()
      res.send(200, { acl })
      next()
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async del (req, res, next) {
    try {
      const task = req.task
      task.acl = []
      await task.save()
      res.send(200, { acl: task.acl })
      next()
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  }
}
