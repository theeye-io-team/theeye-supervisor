"use strict";

var config = require('config');
var lodash = require('lodash');
var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var ResourceService = require('./resource');
var CustomerService = require('./customer');
var HostService = require('./host');
var logger = require('../lib/logger')(':monitor');

const Constants = require('../constants/monitors');
const Scheduler = require('../service/scheduler');

module.exports = {
  start: function() {
    let mconfig = config.get('monitor');
    // to seconds
    var interval = mconfig.resources_check_failure_interval_milliseconds / 1000;

    Scheduler.agenda.define(
      'monitoring',
      { lockLifetime: (5 * 60 * 1000) }, // max lock
      (job, done) => { checkResourcesState(done) }
    );
    Scheduler.agenda.every(`${interval} seconds`,'monitoring');
    logger.log('monitoring started');
  }
};


function checkResourcesState(done){
  logger.debug('***** CHECKING RESOURCES STATUS *****');
  Resource
  .find({ 'enable': true })
  .exec(function(err,resources){
    var total = resources.length;
    logger.debug('running %s checks',total);
    var completed = lodash.after(total,function(){
      logger.log('releasing monitoring job');
      done();
    });

    resources.forEach(resource => {
      runChecks(resource,()=>completed());
    });
  });
}

function runChecks(resource,done) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    function(error,cconfig) {
      if(error){
        logger.error('customer %s configuration fetch failed',resource.customer_name);
        return done();
      }
      if(!cconfig){
        logger.error('customer %s configuration not found',resource.customer_name);
        return done();
      }

      switch(resource.type){
        case 'host':
          checkHostResourceStatus(resource,done);
          break;
        case 'script':
        case 'scraper':
        case 'process':
        case 'dstat':
        case 'psaux':
          checkResourceMonitorStatus(resource,cconfig,done);
          break;
        case 'default':
          logger.error('unhandled resource %s', resource.type);
          done();
          break;
      }
    }
  );
}

function checkResourceMonitorStatus(resource,cconfig,done) {
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
      logger.debug('resource hasn\'t got any monitor');
      return done();
    }

    logger.debug('checking monitor "%s"', resource.name);
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

  logger.debug('checking host resource %s', resource.name);
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
  logger.debug(options);
  var valid, nowTime = Date.now();
  var loopDuration = options.loop_duration;
  var loopThreshold = options.loop_threshold;
  var failedLoopsCount = options.fails_count;
  var lastUpdate = options.last_update;
  var timeElapsed = nowTime - lastUpdate;
  var updateThreshold = loopDuration + loopThreshold;

  var elapsedMinutes = Math.floor(timeElapsed/1000/60);
  logger.debug('last update time elapsed ' + elapsedMinutes + ' minutes');

  var failedLoops = Math.floor(timeElapsed / loopDuration);
  logger.debug('failed loops count %s', failedLoops);
  if(timeElapsed > updateThreshold) {
    if(failedLoops > failedLoopsCount) {
      logger.debug('last update check failed %s times',failedLoops);
      done(null,valid=false,failedLoops);
    } else {
      done(null,valid=true,failedLoops);
    }
  } else {
    done(null,valid=true);
  }
}
