
const logger = require('../lib/logger')('eye:controller:form');
const router = require('../router');
const App = require('../app');
const AsyncController = require('../lib/async-controller')

module.exports = function (server) {
  server.get('/form/:task',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'task', required: true }),
    getForm
  )
}

const getForm = AsyncController(async (req, res) => {
  const { task } = req

  return task.task_arguments
})
