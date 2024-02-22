const Dispatcher = require ('./dispatcher')
// event handlers
const TasksTrigger = require('./task-trigger-by')
const WorkflowsTrigger = require('./workflow')
const JobCreated = require('./job-created')
const NestedMonitorsHandler = require('./nested-monitor')

module.exports.createDispatcher = (props) => {
  const dispatcher = new Dispatcher(props)
  registerCallbacks(dispatcher)
  return dispatcher
}

const registerCallbacks = (dispatcher) => {
  dispatcher.register(TasksTrigger)
  dispatcher.register(WorkflowsTrigger)
  dispatcher.register(NestedMonitorsHandler)
  dispatcher.register(JobCreated)
}
