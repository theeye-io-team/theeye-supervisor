const { performance } = require('perf_hooks') // node > 8 required

const App = require('../../app')
const ResourceService = require('../../service/resource')
const MonitorConstants = require('../../constants/monitors')
const Resource = require('../../entity/resource').Entity
const ResourceMonitor = require('../../entity/monitor').Entity
const logger = require('../../lib/logger')(':monitoring:monitors')
const { ObjectId } = require('mongodb')

module.exports = () => {
  const check_interval = App.config.monitor.check_interval

  // to seconds
  const interval = check_interval / 1000

  App.scheduler.agenda.define(
    'monitoring',
    { lockLifetime: (5 * 60 * 1000) }, // max lock
    checkResourcesState
  )

  App.scheduler.agenda.every(`${interval} seconds`, 'monitoring')
}

const checkResourcesState = async (job) => {
  logger.debug('***** CHECKING MONITORS STATE *****')

  // First find resources that might need checking
  const resources = await Resource.find({
    enable: true,
    state: { $ne: MonitorConstants.RESOURCE_STOPPED },
    type: { $ne: MonitorConstants.RESOURCE_TYPE_NESTED },
    $or: [
      { last_update: null },
      {
        last_update: {
          // Skip resources updated in the last minute
          $lt: new Date(Date.now() - (60 * 1000))  // 1 minute
        }
      }
    ]
  }).select('_id type name last_update fails_count').lean()

  if (resources.length === 0) { return }

  // Then get monitors only for these resources using Mongoose model
  const enabledMonitors = await ResourceMonitor.find({
    enable: true,
    resource: { $in: resources.map(r => r._id) }
  }).select('resource looptime').lean()

  // Create a map for quick lookup
  const monitorMap = new Map(
    enabledMonitors.map(m => [m.resource.toString(), m.looptime])
  )

  // Process resources with a simple for loop
  const resourcesToCheck = []
  for (let resource of resources) {
    const looptime = monitorMap.get(resource._id.toString())
    if (!looptime) continue

    if (!resource.last_update || 
        resource.last_update < new Date(Date.now() - looptime)) {
      resource.monitor = { looptime }
      resourcesToCheck.push(resource)
    }
  }

  logger.debug('%s active monitors to checks', resourcesToCheck.length)
  if (resourcesToCheck.length === 0) { return }

  const t0 = performance.now()
  let checksCount = 0
  for (let resource of resourcesToCheck) {
    checksCount++
    await checkRunningMonitors(resource)
  }

  const t1 = performance.now()
  const tt = (t1 - t0) / 1000

  logger.log(`${checksCount} monitors checked after ${tt} ms`)
}

const checkRunningMonitors = async (resource) => {
  try {
    if (resource.type === MonitorConstants.RESOURCE_TYPE_HOST) {
      await checkHostResourceStatus(resource)
    } else {
      await checkResourceMonitorStatus(resource)
    }
  } catch (err) {
    logger.error(err)
  }
}

const checkResourceMonitorStatus = async (resource) => {
  logger.debug('checking monitor "%s"', resource.name)

  const trigger = triggerAlert(
    resource.last_update,
    resource.monitor.looptime,
    resource.fails_count,
    App.config.monitor.fails_count_alert
  )

  if (trigger === true) {
    const model = await Resource.findById(resource._id)
    const manager = new ResourceService(model)
    await manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
  }
  return
}

const checkHostResourceStatus = async (resource) => {
  logger.debug('checking host resource %s', resource.name)
  const trigger = triggerAlert(
    resource.last_update,
    resource.monitor.looptime,
    resource.fails_count,
    App.config.monitor.fails_count_alert
  )

  if (trigger === true) {
    const model = await Resource.findById(resource._id)
    const manager = new ResourceService(model)
    await manager.handleState({ state: MonitorConstants.RESOURCE_STOPPED })
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
function triggerAlert(
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

  let timeElapsed = Date.now() - lastUpdate.getTime()
  let loopsElapsed = Math.floor(timeElapsed / loopDuration)

  logger.debug({
    'fails count': failsCount,
    'last update': lastUpdate,
    'loops elapsed': loopsElapsed,
    'loop duration': `${loopDuration} (${(loopDuration / (60 * 1000)).toFixed(2)} mins)`,
    'time elapsed (mins)': (timeElapsed / 1000 / 60)
  })

  // Only trigger alert if:
  // 1. We've missed more loops than the failsCountThreshold
  // 2. Or if the current fails count indicates we've missed consecutive checks
  if (loopsElapsed > failsCountThreshold) return true
  if (loopsElapsed === failsCount + 1) return true
  return false
}
