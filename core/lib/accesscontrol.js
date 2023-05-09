
const logger = require('./logger')(':lib:rbac')

const { ClientError, ServerError } = require('./error-handler')
const ForbiddenError = new ClientError('Forbidden', { statusCode: 403 })

const Roles = [
  'basic:viewer',
  'basic:user',
  'basic:agent',
  'basic:manager',
  'basic:admin',
  'basic:integration',
  'basic:owner',
  'basic:root'
]

const AccessControl = {
  middleware (app) {
    return function (req, res, next) {
      const action = `${req.route.method}_${req.url}@${req.customer?.name}`

      const attrs = Object.assign({}, req.body, req.params, req.query)

      app.gateway
        .accesscontrol
        .authorize(req.user.id, action, attrs)
        .then(access => {
          req.access = access
          next()
        })
        .catch(err => {
          const serr = new ServerError('Gateway authorization failed', { statusCode: 503 })
          next(serr)
        })
    }
  }
}

module.exports = AccessControl
