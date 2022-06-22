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

  server.get('/gateway/workflow/:workflow', workflowMiddlewares)
  server.post('/gateway/workflow/:workflow', workflowMiddlewares)
  server.put('/gateway/workflow/:workflow', workflowMiddlewares)
  server.del('/gateway/workflow/:workflow', workflowMiddlewares)
  server.patch('/gateway/workflow/:workflow', workflowMiddlewares)

  const tasksMiddlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.ensureAllowed({ entity: { name: 'task' } }),
    (req, res, next) => {
      try {
        const task = req.task

        const spec = task.gateway?.openapi_spec
        if (!spec || spec.operation !== req.method.toLowerCase()) {
          throw new ClientError('Method Not Allowed', { statusCode: 405 })
        }

        const requestValidator = new OpenAPIRequestValidator(spec)
        const validator = requestValidator.validateRequest(req)

        if (validator !== undefined) {
          const err = new ClientError('Bad Request', { statusCode: validator.status })
          err.errors = validator.errors
          throw err
        }

        next()
      } catch (err) {
        res.sendError(err)
      }
    },
    createJob
  ]

  server.get('/gateway/task/:task', tasksMiddlewares)
  server.post('/gateway/task/:task', tasksMiddlewares)
  server.put('/gateway/task/:task', tasksMiddlewares)
  server.del('/gateway/task/:task', tasksMiddlewares)
  server.patch('/gateway/task/:task', tasksMiddlewares)
}
