const Controller = require('../../lib/controller')
const App = require('../../app')
const audit = require('../../lib/audit')
//const logger = require('../../lib/logger')('controller:workflow:queue')
const router = require('../../router')

module.exports = (server) => {
  server.put('/workflow/:workflow/queue/pause',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    Controller(pauseQueue),
    audit.afterUpdate('workflow', { display: 'name' })
  )

  server.put('/workflow/:workflow/queue/resume',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    Controller(resumeQueue),
    audit.afterUpdate('workflow', { display: 'name' })
  )
}

const pauseQueue = async ({ workflow }) => {
  await updateWorkflowTasks(workflow, true)
  workflow.paused = true
  await workflow.save()
  return
}

const resumeQueue = async ({ workflow }) => {
  await updateWorkflowTasks(workflow, false)
  workflow.paused = false
  await workflow.save()
  return
}

const updateWorkflowTasks = async (workflow, paused) => {
  const tasks = await App.Models.Task.Entity.find({
    workflow_id: workflow._id
  })

  const promises = []
  for (let task of tasks) {
    task.paused = paused
    promises.push(task.save())
  }

  return Promise.all(promises)
}
