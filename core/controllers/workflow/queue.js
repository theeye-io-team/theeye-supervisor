const AsyncController = require('../../lib/async-controller')
const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const { PRIORITY_LEVELS } = require('../../constants/jobs')
const priorityPayloadMiddleware = require('../queue/priority_middleware')

module.exports = (server) => {
  server.put('/workflow/:workflow/queue/pause',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    AsyncController(pauseQueue),
    audit.afterUpdate('workflow', { display: 'name' })
  )

  server.put('/workflow/:workflow/queue/resume',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    AsyncController(resumeQueue),
    audit.afterUpdate('workflow', { display: 'name' })
  )

  server.put('/workflow/:workflow/queue/priority',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    priorityPayloadMiddleware,
    AsyncController(changePriority),
    audit.afterUpdate('workflow', { display: 'name' })
  )
}

const pauseQueue = async ({ workflow }) => {
  await updateWorkflowTasks(workflow,  {'paused': true})
  workflow.paused = true
  await workflow.save()
  return
}

const resumeQueue = async ({ workflow }) => {
  await updateWorkflowTasks(workflow, {'paused': false})
  workflow.paused = false
  await workflow.save()
  return
}

const changePriority = async ({ workflow, body }) => {
  const { number, level } = body
  if (number) {
    workflow.priority = number
  } else if (level) {
    workflow.priority = PRIORITY_LEVELS[level]
  }

  await updateWorkflowTasks(workflow, { 'priority': workflow.priority })
  await workflow.save()
  return { priority: workflow.priority }
}

const updateWorkflowTasks = async (workflow, values) => {
  const tasks = await App.Models.Task.Entity.find({
    workflow_id: workflow._id
  })

  const promises = []
  for (let task of tasks) {
    Object.assign(task, values)
    promises.push(task.save())
  }

  return Promise.all(promises)
}
