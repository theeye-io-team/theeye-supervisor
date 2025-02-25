const { performance } = require('perf_hooks') // node > 8 required

const App = require('../../app')
const ResourceService = require('../../service/resource')
const MonitorConstants = require('../../constants/monitors')
const Resource = require('../../entity/resource').Entity
const logger = require('../../lib/logger')(':monitoring:monitors')

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

  // to avoid checking resources that has been recently updated
  const threshold = App.config.monitor.check_threshold || 5000 // milliseconds

  const resources = await Resource.aggregate([
    {
      $match: {
        enable: true,
        state: { $ne: MonitorConstants.RESOURCE_STOPPED },
        type: { $ne: MonitorConstants.RESOURCE_TYPE_NESTED },
        $expr: {
          $or: [
            { $eq: ["$last_update", null] },  // Never updated
            {
              $lt: [
                "$last_update",
                { $subtract: [ new Date(), threshold ] }
              ]
            }
          ]
        }
      }
    }, {
      $lookup: {
        from: "resourcemonitors",
        localField: "_id",
        foreignField: "resource",
        pipeline: [
          {
            $match: {
              enable: true
            }
          },
          {
            $project: {
              _id: 1,
              looptime: 1
            }
          }
        ],
        as: "monitor",
      }
    }, {
      $unwind: "$monitor"
    },
    {
      $match: {
        "monitor.looptime": { $exists: true },  // This implicitly checks for monitor too
        $expr: {
          $or: [
            { $eq: ["$last_check", null] },  // Never checked
            { $lt: [
              "$last_check",
              {
                $dateSubtract: {
                  startDate: "$$NOW",
                  unit: "millisecond",
                  amount: { $toLong: "$monitor.looptime" }
                }
              }
            ] }
          ]
        }
      }
    },
    {
      $project: {
        _id: 1,
        type: 1,
        name: 1,
        monitor: 1,
        last_check: 1,
        last_update: 1,
        fails_count: 1
      }
    }
  ])

  logger.debug('%s active monitors to checks', resources.length)
  if (resources.length === 0) { return }

  const t0 = performance.now()
  let checksCount = 0
  for (let resource of resources) {
    checksCount++
    await checkRunningMonitors(resource)
  }

  const t1 = performance.now()
  const tt = (t1 - t0) / 1000

  logger.log(`${checksCount} monitores checked after ${tt} ms`)
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
  } else {
    await Resource.updateOne(
      { _id: resource._id },
      { $set: { last_check: new Date() } }
    )
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
  } else {
    await Resource.updateOne(
      { _id: resource._id },
      { $set: { last_check: new Date() } }
    )
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
