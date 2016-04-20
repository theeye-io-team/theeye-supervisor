"use strict";

var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var ResourceService = require('./resource');
var CustomerService = require('./customer');
var HostService = require('./host');
var debug = require('../lib/logger')('eye:supervisor:service:monitor');

var config = require('config');

module.exports = {
  start() {
    let interval = config
      .get('monitor')
      .resources_check_failure_interval_milliseconds;

    setInterval(checkResourcesState, interval);
  }
};

function checkResourcesState() {
  debug.log('***** CHECKING RESOURCES STATUS *****');

  let query = { 'enable': true };
  Resource.find(query,(err,resources) => {
    for(let i=0; i<resources.length; i++){
      let resource = resources[i];
      runChecks(resource);
    }
  });
}

function runChecks(resource) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    (error,cconfig) => {
      switch(resource.type){
        case 'host':
          checkHostResourceStatus(resource);
          break;
        case 'script':
        case 'scraper':
        case 'process':
          checkResourceMonitorStatus(resource,cconfig);
        case 'default':
          break;
      }
    }
  );
}

function checkResourceMonitorStatus(resource,cconfig,done){
  done=done||()=>{};

  ResourceMonitor.findOne({
    'enable': true,
    'resource_id': resource._id 
  },(error,monitor) => {

    if(error) return debug.error('Resource monitor query error : %s', error.message);
    if(!monitor) return;

    debug.log('checking monitor %s', resource.name);
    validLastupdate({
      'loop_duration': monitor.looptime,
      'loop_threshold': cconfig.resources_alert_failure_threshold_milliseconds,
      'last_update': resource.last_update.getTime(),
      'fails_count': resource.fails_count
    }, (error,valid) => {
      if(!valid){
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

  debug.log('checking host resource %s', resource.name);
  validLastupdate({
    'loop_duration':config.get('agent').core_workers.host_ping.looptime,
    'loop_threshold':config.get('monitor').resources_alert_failure_threshold_milliseconds,
    'last_update':resource.last_update.getTime(),
    'fails_count':resource.fails_count
  }, (error,valid) => {
    if(!valid){
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
  debug.log(options);
  var nowTime = Date.now();
  var loopDuration = options.loop_duration;
  var loopThreshold = options.loop_threshold;
  var failedLoopsCount = options.fails_count;
  var lastUpdate = options.last_update;
  var timeElapsed = nowTime - lastUpdate ;
  var updateThreshold = loopDuration + loopThreshold ;

  var elapsedMinutes = Math.floor(timeElapsed/1000/60);
  debug.log(`last update time elapsed ${elapsedMinutes} minutes`);

  var failedLoops = Math.floor(timeElapsed / loopDuration);
  debug.log('failed loops count %s', failedLoops);
  if(timeElapsed > updateThreshold) {
    if(failedLoops > failedLoopsCount) {
      debug.error(`last update check failed ${failedLoops} times`);
      done(null,false);
    } else {
      done(null,true);
    }
  }
}
