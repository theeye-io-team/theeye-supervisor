
const config = require('config')
const logger = require('../../lib/logger')(':monitoring')

const monitorsCheck = require('./monitors')
const nestedCheck = require('./nested')

module.exports = function () {
  if (process.env.MONITORING_DISABLED === 'true') {
    logger.log('WARNING! Monitoring service is disabled via process.env')
  } else if (config.monitor.disabled === true) {
    logger.log('WARNING! Monitoring service is disabled via config')
  } else {
    logger.log('initializing monitoring')

    monitorsCheck({
      check_interval: config.monitor.check_interval,
      agent_keep_alive: config.agent.core_workers.host_ping.looptime
    })

    nestedCheck({
      check_interval: config.monitor.check_interval
    })
  }
}
