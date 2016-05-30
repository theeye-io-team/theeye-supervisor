"use strict";

var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var ResourceService = require('./resource');
var CustomerService = require('./customer');
var HostService = require('./host');
var logger = require('../lib/logger')('eye:supervisor:service:monitor');

var config = require('config');

module.exports = {
  start: function() {
    var interval = config
      .get('monitor')
      .resources_check_failure_interval_milliseconds;

    setInterval(checkResourcesState, interval);
  }
};

function checkResourcesState() {
  logger.log('***** CHECKING RESOURCES STATUS *****');
  var query = { 'enable': true };
  Resource.find(query,function(err,resources){
    for(var i=0; i<resources.length; i++){
      var resource = resources[i];
      runChecks(resource);
    }
  });
}

function runChecks(resource) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    function(error,cconfig) {
      switch(resource.type){
        case 'host':
          checkHostResourceStatus(resource);
          break;
        case 'script':
        case 'scraper':
        case 'process':
        case 'dstat':
        case 'psaux':
          checkResourceMonitorStatus(resource,cconfig);
          break;
        case 'default':
          logger.error('unhandled resource %s', resource.type);
          break;
      }
    }
  );
}

function checkResourceMonitorStatus(resource,cconfig,done){
  done=done||()=>{};

  Resource.findOne({
    'enable': true,
    'resource_id': resource._id 
  },function(error,monitor){

    if(error) return logger.error('Resource monitor query error : %s', error.message);
    if(!monitor) return;

    logger.log('checking monitor "%s"', resource.name);
    var last_update = resource.last_update.getTime();

    validLastupdate({
      'loop_duration': monitor.looptime,
      'loop_threshold': cconfig.resources_alert_failure_threshold_milliseconds,
      'last_update': last_update,
      'fails_count': resource.fails_count
    }, function(error,valid,failedLoops){
      if(!valid){
        resource.fails_count = (failedLoops - 1);
        var manager = new ResourceService(resource);
        manager.handleState({
          'state':'updates_stopped',
          'last_check':Date.now()
        });
      }
      done();
    });
  });
}

function checkHostResourceStatus(resource,done){
  done=done||()=>{};

  logger.log('checking host resource %s', resource.name);
  validLastupdate({
    'loop_duration':config.get('agent').core_workers.host_ping.looptime,
    'loop_threshold':config.get('monitor').resources_alert_failure_threshold_milliseconds,
    'last_update':resource.last_update.getTime(),
    'fails_count':resource.fails_count
  },function(error,valid,failedLoops){
    if(!valid){
      resource.fails_count = (failedLoops - 1);
      var manager = new ResourceService(resource);
      manager.handleState({
        'state':'updates_stopped',
        'last_check':Date.now()
      });
    }
    done();
  });
}

function validLastupdate(options,done)
{
  done=done||()=>{};
  logger.log(options);
  var nowTime = Date.now();
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
      done(null,false,failedLoops);
    } else {
      done(null,true,failedLoops);
    }
  }
}
