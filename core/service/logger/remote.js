const App = require('../../app')
const logger = require('../../lib/logger')(':logger:remote')
const isURL = require('validator/lib/isURL')

const remoteConfig = require('config').logger.remote
const got = require('got')
const request = got.extend({
  timeout: remoteConfig.timeout,
  headers: {
    'content-type': 'application/json'
  }
})

module.exports = {
  /**
   * @param {String} config customer integration config
   * @param {String} topic 
   * @param {Object} payload
   */
  submit (config, topic, payload) {
    // global settings
    if (remoteConfig.enabled === false) {
      logger.log('remote logger submit disabled from system configuration')
      return
    }

    if (!config || config.enabled !== true) {
      logger.log('customer remote logger integration is not enabled')
      return
    }

    if (!isURL(config.url)) {
      logger.error('customer remote logger url is not valid')
      return
    }

    let indexDate = payload.date.split('T')[0].replace(/-/g, '.')
    let url = config.url
      .replace(/%topic%/g, topic)
      .replace(/%date%/g, indexDate)

    request
      .post(url, { body: JSON.stringify(payload) })
      .catch(err => {
        logger.error('Request Error %s', err.message)
        logger.data('Error data sent %j', payload)
      })
  }
}
