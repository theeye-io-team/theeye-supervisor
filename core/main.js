'use strict';

require('./lib/error-extend')
const ErrorHandler = require('./lib/error-handler')
const logger = require('./lib/logger')('main')
logger.log('initializing supervisor');

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

logger.log('setting environment');
require('./environment').setenv(function(){

  logger.log('connecting mongo db');
  require('./lib/mongodb').connect(function(){

    logger.log('initializing scheduler');
    const scheduler = require('./service/scheduler')
    const Events = require('./service/events')

    scheduler.initialize(() => {
      logger.log('initializing server')
      const App = require('./app')
      App.initialize(err => {
        App.jobDispatcher = require('./service/job')
        App.taskManager = require('./service/task')
        App.customer = require('./service/customer')
        App.resource = require('./service/resource')
        App.task = require('./service/task')
        App.file = require('./service/file')
        App.logger = require('./service/logger')
        App.hostTemplate = require('./service/host/group')
        App.scheduler = scheduler
        App.eventDispatcher = Events.createDispatcher() 
        App.notifications = require('./service/notification')

        App.startApi()
        App.startCommander()
        App.startMonitoring(App)
      })
    })
  })
})
