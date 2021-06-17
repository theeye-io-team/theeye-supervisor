const App = require('../../app')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const { ClientError, ServerError } = require('../../lib/error-handler')
const jobArgumentsValidateMiddleware = require('./arguments-validation')

module.exports = async (req) => {
  const { body, query, task, workflow } = req

  const args = await jobArgumentsValidateMiddleware(req)
  const params = paramsFilter(req)

  const payload = {
    assignee: params.assignee,
    task,
    user: req.user,
    customer: req.customer,
    notify: true,
    task_arguments_values: args,
    origin: (req.origin || JobConstants.ORIGIN_USER),
    workflow
  }

  const lifecycle = params.lifecycle
  // allow to control only following lifecycles
  if (
    lifecycle &&
    (
      lifecycle === LifecycleConstants.ONHOLD ||
      lifecycle === LifecycleConstants.SYNCING ||
      lifecycle === LifecycleConstants.LOCKED
    )
  ) {
    payload.lifecycle = lifecycle
  }

  return payload
}

const paramsFilter = (req) => {
  const params = {}
  const { body, query } = req

  params.assignee = (body.assignee || query.assignee)
  if (params.assignee) {
    if (!Array.isArray(params.assignee)) {
      throw new ClientError('assignee array expected', params.assignee)
    }
    if (params.assignee.length === 0) {
      throw new ClientError('assignee is empty')
    }
  }

  params.lifecycle = (body.lifecycle || query.lifecycle)
  if (
    params.lifecycle &&
    Object.values(LifecycleConstants).indexOf(params.lifecycle) === -1
  ) {
    throw new ClientError(`Invalid lifecycle ${params.lifecycle}`)
  }

  params.empty_viewers = (body.empty_viewers || query.empty_viewers)

  return params
}
