"use strict";

var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var ResourceService = require('./resource');
var CustomerService = require('./customer');
var HostService = require('./host');
var logger = require('../lib/logger')('eye:supervisor:service:monitor');
var config = require('config');
var MonitorChecker = require('../entity/monitor/checker').Entity;
var _ = require('lodash');

const Constants = require('../constants/monitors');

module.exports = {
  start: function() {
    var interval = config
      .get('monitor')
      .resources_check_failure_interval_milliseconds;

    Checker.setup();
    setInterval(checkResourcesState, interval);
  }
};

var Checker = {
  setup:function(){
    MonitorChecker.find().exec(function(err,checker){
      if(err) throw err;
      if(Array.isArray(checker)){
        if(checker.length == 0){
          checker = new MonitorChecker();
          checker.save(function(err){
            if(err) logger.error(err);
            else logger.log('monitoring job created');
          });
        }
      }
    });
  },
  getJob: function(next){
    next||(next=function(){});
    MonitorChecker.find({enabled:true}).exec(function(err,result){
      if(err) throw err;
      if(Array.isArray(result)){
        if(result.length == 0){
          logger.log('no checker enabled');
          return next(null);
        }
        var checker = result[0];
        next(checker);
      }
    });
  }
};


function takeCheckerJob(next){
  Checker.getJob(function(job){
    if(!job) return;
    if(!job.inProgress()){
      logger.log('taking check job');
      job.take(next);
    } else {
      logger.log('in progress');
    }
  });
}

function releaseCheckerJob(next){
  Checker.getJob(function(job){
    if(!job) return;
    if(job.inProgress()){
      logger.log('releasing check job');
      job.release(function(){
        logger.log('released!');
      });
    }
  });
}

function checkResourcesState(){
  logger.log('preparing monitoring cicle');
  takeCheckerJob(function(){
    logger.log('***** CHECKING RESOURCES STATUS *****');
    var query = { 'enable': true };
    Resource.find(query,function(err,resources){

      var total = resources.length;
      logger.log('running %s checks',total);
      var completed = _.after(total,function(){
        logger.log('releasing monitoring job');
        releaseCheckerJob();
      });

      var count = 0;
      for(var i=0; i<resources.length; i++){
        var resource = resources[i];
        runChecks(resource,function(){
          logger.log('check completed %s',++count);
          completed();
        });
      }
    });
  });
}

function runChecks(resource,completed) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    function(error,cconfig) {
      if(error){
        logger.error('customer %s configuration fetch failed',resource.customer_name);
        return completed();
      }
      if(!cconfig){
        logger.error('customer %s configuration not found',resource.customer_name);
        return completed();
      }

      switch(resource.type){
        case 'host':
          checkHostResourceStatus(resource,completed);
          break;
        case 'script':
        case 'scraper':
        case 'process':
        case 'dstat':
        case 'psaux':
          checkResourceMonitorStatus(resource,cconfig,completed);
          break;
        case 'default':
          logger.error('unhandled resource %s', resource.type);
          completed();
          break;
      }
    }
  );
}

function checkResourceMonitorStatus(resource,cconfig,done)
{
  done||(done=function(){});

  ResourceMonitor.findOne({
    'enable': true,
    'resource_id': resource._id 
  },function(error,monitor){
    if(error){
      logger.error('Resource monitor query error : %s', error.message);
      return done();
    }
    if(!monitor){
      logger.log('resource has not got any monitor');
      return done();
    }

    logger.log('checking monitor "%s"', resource.name);
    var last_update = resource.last_update.getTime();

    validLastupdate({
      'loop_duration': monitor.looptime,
      'loop_threshold': cconfig.resources_alert_failure_threshold_milliseconds,
      'last_update': last_update,
      'fails_count': resource.fails_count
    },function(error,valid,failedLoops){
      if(!valid){
        var manager = new ResourceService(resource);
        manager.handleState({
          'state':Constants.RESOURCE_STOPPED,
          'last_check':Date.now()
        });
      }
      done();
    });
  });
}

function checkHostResourceStatus(resource,done)
{
  done||(done=function(){});

  logger.log('checking host resource %s', resource.name);
  validLastupdate({
    'loop_duration':config.get('agent').core_workers.host_ping.looptime,
    'loop_threshold':config.get('monitor').resources_alert_failure_threshold_milliseconds,
    'last_update':resource.last_update.getTime(),
    'fails_count':resource.fails_count
  },function(error,valid,failedLoops){
    if(!valid){
      var manager = new ResourceService(resource);
      manager.handleState({
        'state':Constants.RESOURCE_STOPPED,
        'last_check':Date.now()
      });
    }
    done();
  });
}

function validLastupdate(options,done)
{
  done||(done=()=>{});
  logger.log(options);
  var valid, nowTime = Date.now();
  var loopDuration = options.loop_duration;
  var loopThreshold = options.loop_threshold;
  var failedLoopsCount = options.fails_count;
  var lastUpdate = options.last_update;
  var timeElapsed = nowTime - lastUpdate;
  var updateThreshold = loopDuration + loopThreshold;

  var elapsedMinutes = Math.floor(timeElapsed/1000/60);
  logger.log('last update time elapsed ' + elapsedMinutes + ' minutes');

  var failedLoops = Math.floor(timeElapsed / loopDuration);
  logger.log('failed loops count %s', failedLoops);
  if(timeElapsed > updateThreshold) {
    if(failedLoops > failedLoopsCount) {
      logger.log('last update check failed %s times',failedLoops);
      done(null,valid=false,failedLoops);
    } else {
      done(null,valid=true,failedLoops);
    }
  } else {
    done(null,valid=true);
  }
}
