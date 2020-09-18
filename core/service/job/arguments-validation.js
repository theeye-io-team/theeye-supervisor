const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = ({ task, body, query }) => {
  const dynamicTaskArgs = task.task_arguments.filter(arg => arg.type !== 'fixed')
  let args = []

  if (dynamicTaskArgs.length > 0) {
    if (!body && !query) {
      throw new Error(`Task arguments required`)
    }

    body || (body={})
    query || (query={})

    args = (body.task_arguments || query.task_arguments)
    if (!args) {
      if (Array.isArray(body)) {
        args = body
      } else {
        throw new ClientError(`Invalid arguments length. ${dynamicTaskArgs.length} arguments required`)
      }
    }

    if (!Array.isArray(args) || args.length < dynamicTaskArgs.length) {
      throw new ClientError('invalid task arguments length')
    }
  }

  return args
}
