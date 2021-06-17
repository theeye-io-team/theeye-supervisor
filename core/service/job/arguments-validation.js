const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = ({ task, body, query }) => {
  const dynamicTaskArgs = task.task_arguments.filter(arg => arg.type !== 'fixed')
  let args = []

  if (dynamicTaskArgs.length > 0) {
    if (!body && !query) {
      throw new ClientError(`Task arguments required`)
    }

    body || (body={})
    query || (query={})

    const argumentsLengthError = new ClientError(`Invalid Task Arguments. An array of length ${dynamicTaskArgs.length} is required. Optionals must be null`)

    args = (body.task_arguments || query.task_arguments)
    if (!args) {
      if (Array.isArray(body)) {
        args = body
      } else {
        throw argumentsLengthError
      }
    }

    if (!Array.isArray(args) || args.length < dynamicTaskArgs.length) {
      throw argumentsLengthError
    }
  }

  return args
}
