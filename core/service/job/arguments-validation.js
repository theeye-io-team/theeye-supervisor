const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = ({ task, body, query }) => {
  const dynamicTaskArgs = task.task_arguments.filter(arg => arg.type !== 'fixed')
  let args = []

  if (dynamicTaskArgs.length > 0) {
    if (!body && !query) {
      throw new ClientError(`Task arguments required`)
    }

    //
    // basic supported options.
    //
    // task_arguments param: it must be an array of values.
    const argsParam = (body?.task_arguments || query?.task_arguments)
    if (argsParam) {
      args = argsParam
    } else if (Array.isArray(body)) {
      // body: is an array of values.
      args = body
    } else {
      // there is a JSON body or a list of values encoded in the query
      // map the value the first value of an array to be used as first argument
      const value = (body || query)
      args = [ value ]
    }

    if (!Array.isArray(args) || args.length < dynamicTaskArgs.length) {
      throw new ArgumentsLengthError(dynamicTaskArgs.length)
    }
  }

  return args
}

function ArgumentsLengthError (length) {
  const msg = `Invalid Task Arguments. An array of length ${length} is required. Optionals must be null`
  return new ClientError(msg)
}
