'use strict';

require('./lib/error-extend')
const ErrorHandler = require('./lib/error-handler')
const logger = require('./lib/logger')('main')
logger.log('initializing supervisor');

process.on('SIGINT', function(){
  logger.log('supervisor process ends on "SIGINT"');
  process.exit(0);
});

process.on('SIGTERM', function(){
  logger.log('supervisor process ends on "SIGTERM"');
  process.exit(0);
});

process.on('exit', function(){ // always that the process ends, throws this event
  logger.log('supervisor process ends on "process.exit"');
  process.exit(0);
});

process.on('uncaughtException', function(error){
  logger.error('supervisor process on "uncaughtException"');
  logger.error(error);

  var handler = new ErrorHandler();
  handler.sendExceptionAlert(error);
});

logger.log('setting environment');
require('./environment').setenv(function(){

  logger.log('connecting mongo db');
  require('./lib/mongodb').connect(function(){

    logger.log('initializing scheduler');
    const scheduler = require('./service/scheduler')
    scheduler.initialize(function(){

      logger.log('initializing events dispatcher')
      const dispatcher = require('./service/events')
      dispatcher.initialize(function(){

        require('./service/monitor').start()

        logger.log('initializing server')

        const App = require('./app')
        App.jobDispatcher = require('./service/job')
        App.taskManager = require('./service/task')
        App.eventDispatcher = dispatcher
        App.scheduler = scheduler
        App.customer = require('./service/customer')
        App.start()

        logger.log('supervisor is running')
      })
    })
  })
})
