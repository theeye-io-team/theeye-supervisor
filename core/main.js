"use strict";

var rootPath = require('app-root-path');
require('app-root-path').setPath(rootPath + '/core');

var ErrorHandler = require('./lib/errorHandler');

var logger = require('./lib/logger')('eye:supervisor:main');
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

require("./environment").setenv(
  process.env.NODE_ENV,
  function() {
    logger.log('initializing server');
    var server = require("./server");
    server.start();

    if( ! process.env.NO_MONITORING ) {
      logger.log('initializing monitor');
      var monitor = require('./service/monitor');
      monitor.start();
    }

    logger.log('supervisor is running');
  }
);
