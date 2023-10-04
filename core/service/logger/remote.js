const App = require('../../app')
const logger = require('../../lib/logger')(':logger:remote')
const isURL = require('validator/lib/isURL')

const globalRemoteConfig = require('config').logger.remote
const got = require('got')
const request = got.extend({
  timeout: globalRemoteConfig.timeout,
  headers: {
    'content-type': 'application/json'
  }
})

module.exports = {
  /**
   * @param {String} customer 
   * @param {String} topic 
   * @param {Object} payload
   */
  async submit (customer, topic, payload) {
    const { remote_logger } = customer.config

    // global settings
    if (globalRemoteConfig.enabled === false) {
      logger.log('remote logger submit disabled from system configuration')
      return
    }

    if (!remote_logger || remote_logger.enabled !== true) {
      logger.log('customer remote logger integration is not enabled')
      return
    }

    const indexDate = payload.date.split('T')[0].replace(/-/g, '.')
    const url = remote_logger.url
      .replace(/%topic%/g, topic)
      .replace(/%date%/g, indexDate)

    return request.post(url, { body: JSON.stringify(payload) })
      .catch(err => {
        logger.error('Request Error %s', err.message)
        logger.data('Error data sent %j', payload)

        customer.config.remote_logger.enabled = false
        customer.markModified('config')
        customer.save()
          .then(() => logger.error('remote logger integration disabled'))
          .catch(err => logger.error('remote logger integration unable to update'))
      })

  }
}
