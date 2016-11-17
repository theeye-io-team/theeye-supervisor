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
  start: function () {
    var mconfig = config.get('monitor');
    // to seconds
    var interval = mconfig.check_interval / 1000;

    Scheduler.agenda.define(
      'monitoring',
      { lockLifetime: (5 * 60 * 1000) }, // max lock
      (job, done) => { checkResourcesState(done) }
    );

    Scheduler.agenda.every(`${interval} seconds`,'monitoring');
    logger.log('monitoring started');
  }
};

function checkResourcesState (done) {
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

function runChecks (resource,done) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    function(error,cconfig) {
      if(error){
        logger.error('customer %s configuration fetch failed',resource.customer_name);
        return done();
      }

      if(!cconfig){
        logger.error('customer %s configuration unavailable',resource.customer_name);
        return done();
      }

      switch(resource.type){
        case 'host':
          checkHostResourceStatus(resource, cconfig.monitor, done);
          break;
        case 'script':
        case 'scraper':
        case 'process':
        case 'dstat':
        case 'psaux':
          checkResourceMonitorStatus(resource, cconfig.monitor, done);
          break;
        case 'default':
          logger.error('unhandled resource %s', resource.type);
          done();
          break;
      }
    }
  );
}

function checkResourceMonitorStatus (resource,cconfig,done) {
  done||(done=function(){});

  ResourceMonitor.findOne({
    enable: true,
    resource_id: resource._id 
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

    var trigger = triggerAlert(
      resource.last_update,
      monitor.looptime,
      resource.fails_count,
      cconfig.fails_count_alert
    );

    if( trigger ) {
      var manager = new ResourceService(resource);
      manager.handleState({
        state: Constants.RESOURCE_STOPPED,
        last_check: new Date()
      });
    } else if (resource.state!=Constants.RESOURCE_NORMAL) {
      manager.handleState({
        state: Constants.RESOURCE_NORMAL,
        last_check: new Date()
      });
    } else {
      resource.last_check = new Date();
      resource.save();
    }

    done();
  });
}

function checkHostResourceStatus (resource, cconfig, done) {
  done||(done=function(){});

  logger.debug('checking host resource %s', resource.name);
  var agentKeepAliveLoop = config.get('agent').core_workers.host_ping.looptime;
  var trigger = triggerAlert(
    resource.last_update,
    agentKeepAliveLoop,
    resource.fails_count,
    cconfig.fails_count_alert
  );

  if( trigger ) {
    var manager = new ResourceService(resource);
    manager.handleState({
      state: Constants.RESOURCE_STOPPED,
      last_check: Date.now()
    });
  } else {
    resource.last_check = new Date();
    resource.save();
  }

  done();
}

/**
 *
 * @param {Date} lastUpdate
 * @param {Number} loopDuration
 * @param {Number} failsCount
 * @param {Number} failsCountThreshold
 * @return {Boolean}
 *
 */
function triggerAlert (
  lastUpdate,
  loopDuration,
  failsCount,
  failsCountThreshold
) {
  // ensure parameters
  if (!lastUpdate instanceof Date) return true;
  if (isNaN(loopDuration = parseInt(loopDuration))) return true;
  if (isNaN(failsCount = parseInt(failsCount))) return true;
  if (isNaN(failsCountThreshold = parseInt(failsCountThreshold))) return true;

  var timeElapsed = Date.now() - lastUpdate.getTime();
  var loopsElapsed = Math.floor(timeElapsed / loopDuration);

  logger.debug({
    'last update': lastUpdate,
    'loops elapsed': loopsElapsed,
    'loop duration': loopDuration,
    'time elapsed (mins)': (timeElapsed/1000/60)
  });

  if (loopsElapsed >= 2) {
    if (failsCount == 0) return true;
    if (1 == (loopsElapsed - failsCount)) return true;
    if (loopsElapsed > failsCountThreshold) return true;
    return false;
  }
  return false;
}
