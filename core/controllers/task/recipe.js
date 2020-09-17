const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:recipe');
const router = require('../../router');
const TaskConstants = require('../../constants')

module.exports = (server) => {
  server.get(
    '/:customer/task/:task/recipe',
    [
      server.auth.bearerMiddleware,
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.ensureAllowed({ entity: { name: 'task' } })
    ],
    controller.recipe
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
  recipe (req, res, next) {
    const task = req.task
    const query = req.query || {}

    const data = {}
    data.task = task.templateProperties({ backup: (query.backup === true || query.backup === "true") })

    // only script task has a file so far
    if (task._type === 'ScriptTask') {
      App.file.getRecipe(task.script_id, (err, fprops) => {
        data.file = fprops
        res.send(200, data)
      })
    } else {
      res.send(200, data)
    }
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
        logger.error('%o',err)
        return res.send(err.statusCode || 500, err.message)
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
