const App = require('../../app')
const ACL = require('../../lib/acl')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const { ClientError, ServerError } = require('../../lib/error-handler')
const jobArgumentsValidateMiddleware = require('./arguments-validation')

module.exports = async (req) => {
  const { body, query, task, workflow, user, customer } = req

  const args = await jobArgumentsValidateMiddleware(req)
  const params = paramsFilter(req)

  const payload = {
    task,
    user,
    customer: req.customer,
    notify: true,
    task_arguments_values: args,
    origin: (req.origin || JobConstants.ORIGIN_USER),
    workflow
  }

  let assignee = []
  if (params.assignee) {
    assignee = await verifyUsers({
      users: params.assignee,
      customer,
      task,
      workflow
    })
  }

  let owners = []
  if (user?.id && user?.credential) {
    owners = await verifyUsers({
      users: [ user.id ],
      customer,
      task,
      workflow
    })
  }

  Object.assign(payload, { owners, assignee })

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
  const { body={}, query={} } = req

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

const verifyUsers = async ({ users, customer, workflow, task }) => {
  if (!Array.isArray(users) || users.length === 0) { return }

  // verify that every user is a member of the organization and has acl.
  const members = await App.gateway.member.fromUsers(users, customer)

  // verify users are members of the organization
  for (let member of members) {
    if (member.user_id && member.user.email) {
      ACL.ensureAllowed({
        email: member.user.email,
        credential: member.credential,
        model: (workflow || task)
      })
    }
  }

  return members
}
