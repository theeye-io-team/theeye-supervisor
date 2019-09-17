const after = require('lodash/after')

const App = require('../../app')
const ResourceService = require('../../service/resource')
const ResourceMonitor = require('../../entity/monitor').Entity
const MonitorConstants = require('../../constants/monitors')
const Resource = require('../../entity/resource').Entity
const logger = require('../../lib/logger')(':monitoring:nested')

module.exports = (options) => {
  // to seconds
  var interval = options.check_interval / 1000

  App.scheduler.agenda.define(
    'nested-monitoring',
    { lockLifetime: (5 * 60 * 1000) }, // max lock
    (job, done) => checkNestedMonitorsState(done)
  )

  App.scheduler.agenda.every(`${interval} seconds`, 'nested-monitoring')

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

        // total nested monitors count
        if (resources.length===0) { return done() }

        var total = resources.length
        var completed = after(total, function () {
          logger.log('releasing nested monitoring check')
          done()
        })

        logger.debug('running %s checks', total)
        for (let resource of resources) {
          checkNestedMonitor(resource, (err) => completed())
        }
      })
  }

  /**
   *
   * @summary NestedMonitor state is determined by the worst state within all the nested monitors it includes in the group.
   *
   */
  const checkNestedMonitor = (resource, done) => {
    // search nested monitor
    let query = ResourceMonitor.findOne({
      enable: true,
      resource_id: resource._id
    })

    query.exec(async (err, monitor) => {
      if (err) {
        logger.error(err)
        return done(err)
      }

      if (!monitor) {
        // this is a failure. disable monitor
        resource.enable = false
        resource.save()
        let err = new Error('no monitor found for resource %s. resource monitoring disabled', resource._id)
        logger.error(err)
        return done(err)
      }

      try {
        let ids = monitor.config.monitors
        let nestedResources = []

        for (let id of ids) {
          let nested = await Resource.findById(id).exec()
          nestedResources.push(nested)
        }

        let states = nestedResources.map(nested => nested.state)
        let manager = new ResourceService(resource)

        if (states.find(state => state === MonitorConstants.RESOURCE_NORMAL) === undefined) {
          // all failing and already in failure state. stop checking
          if (resource.state !== MonitorConstants.RESOURCE_FAILURE) {
            manager.handleState({
              state: MonitorConstants.RESOURCE_FAILURE
            })
          } else {
            logger.log('no monitors recovery detected')
            return done()
          }
        } else {
          // recover
          manager.handleState({ state: MonitorConstants.RESOURCE_NORMAL })
        }

        done()
      } catch (e) {
        console.error(e)
        done(e)
      }
    })
  }
}
