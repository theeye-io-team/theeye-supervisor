const Controller = require('../../lib/controller')
const App = require('../../app')
const audit = require('../../lib/audit')
//const logger = require('../../lib/logger')('controller:task:queue')
const router = require('../../router')

module.exports = (server) => {
  server.put('/task/:task/queue/pause',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    Controller(pauseQueue),
    audit.afterUpdate('task', { display: 'name' })
  )

  server.put('/task/:task/queue/resume',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    Controller(resumeQueue),
    audit.afterUpdate('task', { display: 'name' })
  )
}

const pauseQueue = ({ task }) => {
  task.paused = true
  return task.save()
}

const resumeQueue = ({ task }) => {
  task.paused = false
  return task.save()
}
