const App = require('../../app')
const logger = require('../../lib/logger')('service:job:create')
const JobConstants = require('../../constants/jobs')

/**
 *
 * Create middleware
 *
 * @param {Object[]} req.body.task_arguments an array of objects with { order, label, value } arguments definition
 *
 */
module.exports = async (req, res, next) => {
  try {
    validateTaskArgumentsMiddleware(req, res)

    const { task, user, customer, task_arguments } = req

    logger.log('creating new job')

    const inputs = {
      task,
      user,
      customer,
      notify: true,
      origin: (req.origin || JobConstants.ORIGIN_USER),
      task_arguments_values: task_arguments 
    }

    const job = await App.jobDispatcher.create(inputs)

    let data
    if (job.agenda && job.agenda.constructor.name === 'Agenda') {
      data = job.attrs
    } else {
      data = job.publish()
    }

    data.user = {
      id: user.id,
      username: user.username,
      email: user.email
    }

    res.send(200, data)
    req.job = job
    next()
  } catch (err) {
    logger.error(err)
    return res.send(err.statusCode || 500, err.message)
  }
}

const validateTaskArgumentsMiddleware = (req, res) => {
  let args
  let task = req.task

  if (task.task_arguments.length > 0) {
    // we need arguments to start this task ! lets validate them
    args = (req.body.task_arguments || req.query.task_arguments)

    if (!args) {
      // task_arguments keys are not present.
      if ( Array.isArray(req.body) ) {
        // the full body is the array of arguments
        args = req.body
      } else {
        throw new Error('task need arguments')
      }
    } else {
      let taskArgs = task.task_arguments.filter(arg => arg.type !== 'fixed')
      if (args.length < taskArgs.length) {
        throw new Error('invalid task arguments length')
      }
    }
  } else {
    args = []
  }

  req.task_arguments = args
}
