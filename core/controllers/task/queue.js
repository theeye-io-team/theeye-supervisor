const AsyncController = require('../../lib/async-controller')
const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const { PRIORITY_LEVELS } = require('../../constants/jobs')
const priorityPayloadMiddleware = require('../queue/priority_middleware')

module.exports = (server) => {
  server.put('/task/:task/queue/pause',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    AsyncController(pauseQueue),
    audit.afterUpdate('task', { display: 'name' })
  )

  server.put('/task/:task/queue/resume',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    AsyncController(resumeQueue),
    audit.afterUpdate('task', { display: 'name' })
  )

  server.put('/task/:task/queue/priority',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    priorityPayloadMiddleware,
    AsyncController(changePriority),
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

const changePriority = async ({ task, body }) => {
  const { number, level } = body
  if (number) {
    task.priority = number
  } else if (level) {
    task.priority = PRIORITY_LEVELS[level]
  }

  await task.save()
  return { priority: task.priority }
}
