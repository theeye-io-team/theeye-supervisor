const { performance } = require('perf_hooks')

const App = require('../../app')
const ResourceService = require('../../service/resource')
const MonitorConstants = require('../../constants/monitors')
const ResourceMonitor = require('../../entity/monitor').Entity
const Resource = require('../../entity/resource').Entity
const logger = require('../../lib/logger')(':monitoring:monitors')

module.exports = () => {
  // to seconds
  const interval = App.config.monitor.check_interval / 1000

  App.scheduler.agenda.define(
    'monitoring',
    { lockLifetime: (5 * 60 * 1000) }, // max lock
    checkResourcesState
  )

  App.scheduler.agenda.every(`${interval} seconds`, 'monitoring')
}

const checkResourcesState = async () => {
  logger.debug('***** CHECKING AUTOMATIC MONITORS STATE *****')
  const resources = await Resource.aggregate([
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

  const date = new Date()
  logger.debug(`${resources.length} active monitors to checks`)
  if (resources.length === 0) { return }

  const t0 = performance.now()

  for (const resource of resources) {
    const last_check = (resource.last_check || new Date())
    const need2check = (last_check.getTime() + resource.monitor.looptime + 5000) < date.getTime()
    if (need2check) {
      const data = Object.assign({}, resource, { monitor: null })
      const model = Resource.hydrate(data)
      await checkRunningMonitors(model)
    }
  }

  const t1 = performance.now()
  const tt = (t1 - t0) / 1000
  logger.log(`${resources.length} monitores checked after ${tt} ms`)
}

const checkRunningMonitors = async (resource) => {
  if (resource.type === 'host') {
    await checkHostResourceStatus(resource)
  } else {
    await checkResourceMonitorStatus(resource)
  }
}

const checkResourceMonitorStatus = async (resource) => {
  const monitor = await ResourceMonitor.findOne({ enable: true, resource_id: resource._id })

  if (!monitor) {
    logger.debug(`resource ${resource.name} hasn't got any monitor`)
    return
  }

  logger.debug(`checking monitor ${resource.name}`)

  const trigger = triggerAlert(
    resource.last_update,
    monitor.looptime,
    resource.fails_count,
    App.config.monitor.fails_count_alert
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

const checkHostResourceStatus = async (resource) => {
  logger.debug(`checking host resource ${resource.name}`)
  const agentKeepAlive = App.config.agent.core_workers.host_ping.looptime
  const failsCountThreshold = App.config.monitor.fails_count_alert

  const trigger = triggerAlert(
    resource.last_update,
    agentKeepAlive,
    resource.fails_count,
    failsCountThreshold
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
 * @param {Date} lastUpdate
 * @param {Number} loopDuration
 * @param {Number} failsCount
 * @param {Number} failsCountThreshold
 * @return {Boolean}
 */
const triggerAlert = (
  lastUpdate,
  loopDuration,
  failsCount,
  failsCountThreshold
) => {
  // ensure parameters
  if (!(lastUpdate instanceof Date)) return true
  if (isNaN(loopDuration = parseInt(loopDuration))) return true
  if (isNaN(failsCount = parseInt(failsCount))) return true
  if (isNaN(failsCountThreshold = parseInt(failsCountThreshold))) return true

  if (!lastUpdate) return true

  const timeElapsed = Date.now() - lastUpdate.getTime()
  const loopsElapsed = Math.floor(timeElapsed / loopDuration)

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