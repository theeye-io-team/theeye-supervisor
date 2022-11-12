const Dispatcher = require ('./dispatcher')
const TasksTrigger = require('./task-trigger-by')
const WorkflowsTrigger = require('./workflow')
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
}
