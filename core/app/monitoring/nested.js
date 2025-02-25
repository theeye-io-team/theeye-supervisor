const App = require('../../app')
const mongoose = require('mongoose')
const ResourceService = require('../../service/resource')
const MonitorConstants = require('../../constants/monitors')
const Resource = require('../../entity/resource').Entity
const logger = require('../../lib/logger')(':monitoring:nested')

module.exports = () => {
  // to seconds
  const interval = App.config.monitor.check_interval / 1000

  App.scheduler.agenda.define(
    'nested-monitoring',
    { lockLifetime: (5 * 60 * 1000) }, // max lock
    checkNestedMonitorsState
  )

  App.scheduler.agenda.every(`${interval} seconds`, 'nested-monitoring')
}

const checkNestedMonitorsState = async (job) => {
  logger.debug('***** CHECKING NESTED MONITORS STATE *****')
  const resources = await Resource.aggregate([
    {
      $match: {
        enable: true,
        type: MonitorConstants.RESOURCE_TYPE_NESTED
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

  logger.debug(`%s active nested monitors to checks`, resources.length)
  if (resources.length === 0) { return }

  const t0 = performance.now()

  for (let resource of resources) {
    await checkNestedMonitor(resource)
  }

  const t1 = performance.now()
  const tt = (t1 - t0) / 1000

  logger.log(`${resources.length} nested monitors checked after ${tt} ms`)
}

/**
 *
 * @summary NestedMonitor state is determined by the worst state
 *  within all the nested monitors it includes in the group.
 */
const checkNestedMonitor = async (props) => {
  // search nested monitor
  const monitor = props.monitor
  delete props.monitor
  const resource = Resource.hydrate(props)

  if (!monitor) {
    // this is an internal error. disable monitor
    resource.enable = false
    resource.save()
    const err = new Error('no monitor found for resource %s. resource monitoring disabled', resource._id)
    logger.error(err)
    return
  }

  const manager = new ResourceService(resource)

  const ids = monitor.config
    .monitors
    .map(m => new mongoose.Types.ObjectId(m.id))

  const nestedResources = await Resource.aggregate([
    {
      $match: {
        _id: { $in: ids }
      }
    }, {
      $project: {
        _id: 1,
        state: 1
      }
    }
  ])

  const normalResources = nestedResources.filter(
    nested => nested.state === MonitorConstants.RESOURCE_NORMAL)

  if (normalResources.length === monitor.config.monitors.length) {
    // ALL monitors are normal
    await manager.handleState({ state: MonitorConstants.RESOURCE_NORMAL })
  } else if (resource.state !== MonitorConstants.RESOURCE_FAILURE) {
    // At least one monitor is failing
    await manager.handleState({ state: MonitorConstants.RESOURCE_FAILURE })
  }
}
