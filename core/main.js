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
    const Events = require('./service/events')

    scheduler.initialize(() => {
      logger.log('initializing server')
      const App = require('./app')
      App.initialize(err => {
        App.jobDispatcher = require('./service/job')
        App.taskManager = require('./service/task')
        App.customer = require('./service/customer')
        App.resource = require('./service/resource')
        App.scheduler = scheduler
        App.eventDispatcher = Events.createDispatcher() 
        App.notifications = require('./service/notification')
        App.start()
        logger.log('supervisor api is running')
        require('./service/monitor').start()
      })
    })
  })
})
