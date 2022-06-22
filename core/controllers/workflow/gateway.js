const restify = require('restify')
const App = require('../../app')
const createJob = require('../../service/job/create')
const router = require('../../router')
const JobConstants = require('../../constants/jobs')
const { ClientError, ServerError } = require('../../lib/error-handler')

const OpenAPIRequestValidator = require('openapi-request-validator').default

module.exports = (server) => {
  // GATEWAY METHODS
  const workflowMiddlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    (req, res, next) => {
      const workflow = req.workflow
      const method = req.method
      next()
    },
    createJob
  ]

  server.get('/workflow/:workflow/gateway', workflowMiddlewares)
  server.post('/workflow/:workflow/gateway', workflowMiddlewares)
  server.put('/workflow/:workflow/gateway', workflowMiddlewares)
  server.del('/workflow/:workflow/gateway', workflowMiddlewares)
  server.patch('/workflow/:workflow/gateway', workflowMiddlewares)
}
