const after = require('lodash/after')
const { performance } = require('perf_hooks') // node > 8 required

const App = require('../../app')
const CustomerService = require('../../service/customer')
const ResourceService = require('../../service/resource')
const MonitorConstants = require('../../constants/monitors')
const ResourceMonitor = require('../../entity/monitor').Entity
const Resource = require('../../entity/resource').Entity
const logger = require('../../lib/logger')(':monitoring:monitors')

module.exports = (options) => {
  // to seconds
  var interval = options.check_interval / 1000

  App.scheduler.agenda.define(
    'monitoring',
    { lockLifetime: (5 * 60 * 1000) }, // max lock
    (job, done) => { checkResourcesState(done) }
  )
  App.scheduler.agenda.every(`${interval} seconds`, 'monitoring')

  function checkResourcesState (done) {
    logger.debug('***** CHECKING AUTOMATIC MONITORS STATE *****')
    Resource
      .aggregate([
        {
          $match: {
            enable: true,
            state: { $ne: MonitorConstants.RESOURCE_STOPPED },
            type: { $ne: MonitorConstants.RESOURCE_TYPE_NESTED }
          }
        }, {
          $lookup: {
            from: "resourcemonitors",
            localField: "_id",
            foreignField: "resource",
            as: "monitor"
          }
        }, {
          $unwind: "$monitor"
        }
      ])
      .exec(function (err, resources) {
        if (err) {
          logger.error(err)
          return done(err)
        }

        const date = new Date()
        const total = resources.length
        logger.debug('%s active monitors to checks', total)
        if (resources.length===0) { return done() }

        let t0 = performance.now()
        let checksCount = 0
        const completed = after(total, () => {
          let t1 = performance.now()
          let tt = (t1 - t0) / 1000
          logger.log(`${checksCount} monitores checked after ${tt} ms`)
          done()
        })

        resources.forEach(resource => {
          let last_check = (resource.last_check || new Date())
          let check = (last_check.getTime() + resource.monitor.looptime + 5000) < date.getTime()
          if (check) {
            checksCount++
            let model = Resource.hydrate(Object.assign({}, resource, { monitor: null }))
            checkRunningMonitors(model, () => completed())
          } else {
            completed()
          }
        })
      })
  }

  async function checkRunningMonitors (resource, done) {
    try {
      if (resource.type === 'host') {
        await checkHostResourceStatus(resource, App.config.monitor)
      } else {
        await checkResourceMonitorStatus(resource, App.config.monitor)
      }
      done()
    } catch (err) {
      logger.error(err)
      done(err)
    }
  }

  async function checkResourceMonitorStatus (resource, config) {
    let monitor = ResourceMonitor.findOne({ enable: true, resource_id: resource._id })

    if (!monitor) {
      logger.debug('resource hasn\'t got any monitor')
      return
    }

    logger.debug('checking monitor "%s"', resource.name)

    let trigger = triggerAlert(
      resource.last_update,
      monitor.looptime,
      resource.fails_count,
      config.fails_count_alert
    )

    if (trigger === true) {
      const manager = new ResourceService(resource)
      await manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
    } else {
      resource.last_check = new Date()
      await resource.save()
    }
    return
  }

  async function checkHostResourceStatus (resource, config) {
    logger.debug('checking host resource %s', resource.name)
    let trigger = triggerAlert(
      resource.last_update,
      options.agent_keep_alive,
      resource.fails_count,
      config.fails_count_alert
    )

    if (trigger === true) {
      const manager = new ResourceService(resource)
      await manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
    } else {
      resource.last_check = new Date()
      await resource.save()
    }
    return
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
}
