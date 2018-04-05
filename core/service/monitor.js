'use strict'

const App = require('../app')
const config = require('config')
const after = require('lodash/after')
const logger = require('../lib/logger')(':monitor')
const asyncMap = require('async/map')
var Resource = require('../entity/resource').Entity
var ResourceMonitor = require('../entity/monitor').Entity
var ResourceService = require('./resource')
var CustomerService = require('./customer')

const MonitorConstants = require('../constants/monitors')

module.exports = {
  start () {
    const mconfig = config.get('monitor')
    if (process.env.MONITORING_DISABLED === 'true') {
      logger.log('WARNING! Monitoring service is disabled via process.env')
    } else if (mconfig.disabled === true) {
      logger.log('WARNING! Monitoring service is disabled via config')
    } else {
      logger.log('initializing monitor')
      // to seconds
      var interval = mconfig.check_interval / 1000

      App.scheduler.agenda.define(
        'monitoring',
        { lockLifetime: (5 * 60 * 1000) }, // max lock
        (job, done) => { checkResourcesState(done) }
      )

      App.scheduler.agenda.define(
        'nested-monitoring',
        { lockLifetime: (5 * 60 * 1000) }, // max lock
        (job, done) => { checkNestedMonitorsState(done) }
      )

      App.scheduler.agenda.every(`${interval} seconds`, 'monitoring')
      App.scheduler.agenda.every(`${interval} seconds`, 'nested-monitoring')

      logger.log('supervisor monitoring is running')
    }
  }
}

const checkNestedMonitorsState = (done) => {
  logger.debug('***** CHECKING NESTED MONITORS STATE *****')
  Resource
    .find({
      enable: true,
      type: MonitorConstants.RESOURCE_TYPE_NESTED
    })
    .exec(function (err, resources) {
      if (err) {
        logger.error(err)
        return done(err)
      }

      var total = resources.length
      logger.debug('running %s checks', total)
      var completed = after(total, function () {
        logger.log('releasing nested monitoring check')
        done()
      })

      resources.forEach(resource => {
        checkNestedMonitor(resource, () => completed())
      })
    })
}

/**
 *
 * @summary NestedMonitor state is determined by the worst state within all the nested monitors it includes in the group.
 *
 */
const checkNestedMonitor = (resource, done) => {
  ResourceMonitor
    .findOne({
      enable: true,
      resource_id: resource._id
    })
    .exec(function (err, monitor) {
      if (err) {
        logger.error(err)
        return done(err)
      }

      if (!monitor) {
        resource.enable = false
        resource.save()

        let err = new Error('no monitor found for resource %s. resource monitoring disabled', resource._id)
        logger.error(err)
        return done(err)
      } else {
        let ids = monitor.config.monitors
        asyncMap(
          ids,
          function (_id, done) {
            Resource.findById( _id, (err, nestedResource) => {
              if (err) return done(err)
              return done(null, nestedResource)
            })
          },
          function (err, nestedResources) {
            //let state = App.resource.getResourcesWorstState(nestedResources)
            let states = []
            nestedResources.forEach(resource => states.push(resource.state))

            var manager = new ResourceService(resource)
            // there are no monitors working fine
            if (states.indexOf(MonitorConstants.RESOURCE_NORMAL) === -1) {
              manager.handleState({ state: MonitorConstants.RESOURCE_FAILURE })
            } else {
              manager.handleState({ state: MonitorConstants.RESOURCE_NORMAL })
            }
            done(err)
          }
        )
      }
    })
}

function checkResourcesState (done) {
  logger.debug('***** CHECKING AUTOMATIC MONITORS STATE *****')
  Resource
    .find({
      enable: true,
      type: {
        $ne: MonitorConstants.RESOURCE_TYPE_NESTED
      }
    })
    .exec(function (err, resources) {
      if (err) {
        logger.error(err)
        return done(err)
      }

      var total = resources.length
      logger.debug('running %s checks', total)
      var completed = after(total, function () {
        logger.log('releasing monitoring job')
        done()
      })

      resources.forEach(resource => {
        runChecks(resource, () => completed())
      })
    })
}

function runChecks (resource, done) {
  CustomerService.getCustomerConfig(
    resource.customer_id,
    function (error, cconfig) {
      if (error) {
        logger.error('customer %s configuration fetch failed', resource.customer_name)
        return done()
      }

      if (!cconfig) {
        logger.error('customer %s configuration unavailable', resource.customer_name)
        return done()
      }

      if (resource.type === 'host') {
        checkHostResourceStatus(resource, cconfig.monitor, done)
      } else {
        checkResourceMonitorStatus(resource, cconfig.monitor, done)
      }
    }
  )
}

function checkResourceMonitorStatus (resource, cconfig, done) {
  done || (done = function () {})

  ResourceMonitor.findOne({
    enable: true,
    resource_id: resource._id
  }, function (error, monitor) {
    if (error) {
      logger.error('Resource monitor query error : %s', error.message)
      return done()
    }

    if (!monitor) {
      logger.debug('resource hasn\'t got any monitor')
      return done()
    }

    logger.debug('checking monitor "%s"', resource.name)

    var trigger = triggerAlert(
      resource.last_update,
      monitor.looptime,
      resource.fails_count,
      cconfig.fails_count_alert
    )

    if (trigger === true) {
      var manager = new ResourceService(resource)
      manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
    } else {
      resource.last_check = new Date()
      resource.save()
    }

    done()
  })
}

function checkHostResourceStatus (resource, cconfig, done) {
  done || (done = function () {})

  logger.debug('checking host resource %s', resource.name)
  var agentKeepAliveLoop = config.get('agent').core_workers.host_ping.looptime
  var trigger = triggerAlert(
    resource.last_update,
    agentKeepAliveLoop,
    resource.fails_count,
    cconfig.fails_count_alert
  )

  if (trigger === true) {
    var manager = new ResourceService(resource)
    manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
  } else {
    resource.last_check = new Date()
    resource.save()
  }

  done()
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
  if (!(lastUpdate instanceof Date)) return true
  if (isNaN(loopDuration = parseInt(loopDuration))) return true
  if (isNaN(failsCount = parseInt(failsCount))) return true
  if (isNaN(failsCountThreshold = parseInt(failsCountThreshold))) return true

  if (!lastUpdate) return true

  var timeElapsed = Date.now() - lastUpdate.getTime()
  var loopsElapsed = Math.floor(timeElapsed / loopDuration)

  logger.debug({
    'fails count': failsCount,
    'last update': lastUpdate,
    'loops elapsed': loopsElapsed,
    'loop duration': `${loopDuration} (${(loopDuration / (60 * 1000)).toFixed(2)} mins)`,
    'time elapsed (mins)': (timeElapsed / 1000 / 60)
  })

  if (loopsElapsed >= 2) {
    if (failsCount === 0) return true
    if ((loopsElapsed - failsCount) === 1) return true
    if (loopsElapsed > failsCountThreshold) return true
    return false
  }
  return false
}
