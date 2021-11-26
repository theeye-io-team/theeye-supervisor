const App = require('../../app')
const logger = require('../../lib/logger')('controller:workflow:recipe');
const router = require('../../router');

module.exports = (server) => {
  server.get(
    '/workflow/:workflow/export',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    _export
  )

  server.post(
    '/workflow/import',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    _import
  )
}

/**
 * @summary export workflow recipe
 */
const _export = async (req, res, next) => {
  const workflow = req.workflow

  const graph = workflow.graph

  const expGraph = {}
  expGraph.options = graph.options
  expGraph.nodes = []
  expGraph.edges = []

  const exportedTasks = []
  for (let node of graph.nodes) {
    const taskId = node.value.id
    if (/Event/.test(node.value._type) !== true) {
      const task = await App.Models.Task.Task.findById(taskId)
      const recipe = await taskRecipe(task)
      exportedTasks.push(recipe)
    }
  }

  return res.send(200, exportedTasks)
}

const taskRecipe = (task) => {
  return new Promise((resolve, reject) => {
    App.task.getRecipe(task, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

/**
 * @summary import workflow recipe
 */
const _import = (req, res, next) => {
  res.send(200)
}
