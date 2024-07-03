const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:recipe');
const router = require('../../router');
const TaskConstants = require('../../constants')

module.exports = (server) => {
  server.get(
    '/:customer/task/:task/serialize',
    [
      server.auth.bearerMiddleware,
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.ensureAllowed({ entity: { name: 'task' } })
    ],
    controller.serialize
  )

  server.post(
    '/:customer/task/import',
    [
      server.auth.bearerMiddleware,
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('admin'),
      router.resolve.hostnameToHost({ required: true }),
      router.ensureAllowed({ entity: { name: 'host' } })
    ],
    controller._import
  )
}

const controller = {
  /**
   * @summary get task recipe
   * @param {Mixed} task instance or id
   * @param {Function} next
   */
  serialize (req, res, next) {
    const task = req.task
    const query = req.query || {}

    const options = { mode: query.mode }

    App.task.serialize(task, options, (err, recipe) => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200, recipe)
      }
    })
  },
  /**
   *
   *
   */
  _import (req, res, next) {
    const host = req.host
    const recipe = req.body

    if (!recipe.task) {
      return res.send(400, 'task recipe malkformed. no task provided')
    }

    if (!recipe.task.type) {
      return res.send(400, 'task recipe malkformed. no type provided')
    }

    if (
      recipe.task.type === TaskConstants.TYPE_SCRIPT &&
      !recipe.file
    ) {
      return res.send(400, 'task recipe malkformed. script task requires a file')
    }

    createFromRecipe(req, (err, task) => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200, task)
        next()
      }
    })
  }
}

const createFromRecipe = (req, next) => {
  const recipe = req.body
  const customer = req.customer
  const host = req.host

  //let data = Object.assign({}, recipe.task, {
  //  customer_id: customer._id,
  //  customer: customer,
  //  host: host,
  //  host_id: host._id
  //})
  const onError = (err) => {
    if (err) {
      if (err.name === 'InvalidTaskType') {
        err.statusCode = 400
      }
      if (err.name === 'ValidationError') {
        err.statusCode = 400
      }
    }
    return next(err)
  }

  App.task.createFromTemplate({
    host,
    customer,
    user: req.user,
    template: recipe.task,
    done: (err, task) => {
      if (err) { return onError(err) }

      if (task.type==='script' && recipe.file) {
        App.file.createFromTemplate({
          customer,
          template: recipe.file
        }, (err, file) => {
          if (err) {
            task.remove()
            return onError(err)
          }

          task.script_id = file._id.toString()

          next(null, task)
        })
      } else { return next(null, task) }
    }
  })
}
