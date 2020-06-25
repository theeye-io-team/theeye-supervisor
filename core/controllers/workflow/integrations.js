const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:integrations');
const router = require('../../router');

module.exports = (server) => {
  server.get(
    '/workflows/:workflow/credentials',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.credentials
  )
}

const controller = {
  /**
   * @summary get workflow credentials
   * @param {Mixed} workflow instance or id
   * @param {Function} next
   */
  credentials (req, res, next) {
    let workflow = req.workflow

    res.send(200, { id: workflow._id, secret: workflow.secret })
  }
}
