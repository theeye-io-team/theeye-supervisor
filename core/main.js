const logger = require('./lib/logger')('main')
require('./lib/error-extend')
const ErrorHandler = require('./lib/error-handler')

logger.log('initializing supervisor')

if (!RegExp.escape) {
  RegExp.escape = function(s){
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  }
}

process.on('SIGINT', function(){
  logger.log('supervisor process ends on "SIGINT"')
  process.exit(0)
})

process.on('SIGTERM', function(){
  logger.log('supervisor process ends on "SIGTERM"')
  process.exit(0)
})

process.on('exit', function(){ // always that the process ends, throws this event
  logger.log(`supervisor process ends on "process.exit"`)
  process.exit(0)
})

const handleException = eventName => {
  let handler
  if (process.env.NODE_ENV !== 'production') {
    handler = error => {
      console.error(error)
      process.exit()
    }
  } else {
    handler = error => {
      logger.error(`handling exception ${eventName}`)
      logger.error(error)

      let handler = new ErrorHandler()
      handler.sendExceptionAlert(error)
    }
  }
  return handler
}

process.on('uncaughtException', handleException('uncaughtException'))
process.on('unhandledRejection', handleException('unhandledRejection'))

const boot = async () => {
  if (!process.env.NODE_ENV) {
    logger.error('NODE_ENV is required')
    return process.exit(-1)
  }

  const config = require('config')
  const App = require('./app')
  App.boot(config)
}

boot()
