const App = require('../../app')
const router = require('../../router')
const audit = require('../../lib/audit')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  server.put('/job/:job/acl',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    (req, res, next) => {
      try {
        if (
          req.job.allows_dynamic_settings === false ||
          req.job.allows_dynamic_settings !== true
        ) {
          throw new ClientError('Dynamic settings not allowed', { statusCode: 403 })
        }

        if (!Array.isArray(req.body) || req.body.length === 0) {
          throw new ClientError('Invalid acl format')
        }

        for (let value of req.body) {
          if (typeof value !== 'string') {
            throw new ClientError(`Invalid acl format. Value ${value} must be string`)
          }
        }

        next()
      } catch (err) {
        res.sendError(err)
      }
    },
    replaceAcl,
    audit.afterUpdate('job', { display: 'name' })
  )
}

const replaceAcl = async (req, res, next) => {
  try {
    const job = req.job

    const users = await App.gateway.user.fetch(req.body, { customer_id: req.customer.id })
    if (!users || users.length === 0) {
      throw new ClientError('Invalid members')
    }

    const acl = users.map(user => user.email)

    if (job._type === JobConstants.WORKFLOW_TYPE) {
      App.jobDispatcher.updateWorkflowJobsAcls(job, acl)
    }

    job.acl = acl
    await job.save()
    res.send(200, job.acl)
  } catch (err) {
    res.sendError(err)
  }
}
