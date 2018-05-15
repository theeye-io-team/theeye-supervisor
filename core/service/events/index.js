const Dispatcher = require ('./dispatcher')

module.exports.createDispatcher = (props) => {
  const dispatcher = new Dispatcher(props)
  registerCallbacks(dispatcher)
  return dispatcher
}

const registerCallbacks = (dispatcher) => {
  dispatcher.register( require('./task-trigger-by') )
  dispatcher.register( require('./workflow') )
  dispatcher.register( require('./nested-monitor') )
}
