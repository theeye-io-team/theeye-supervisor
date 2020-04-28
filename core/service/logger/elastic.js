const App = require('../../app')
const logger = require('../../lib/logger')(':logger:elasticsearch')
const isURL = require('validator/lib/isURL')

const elasticConfig = require('config').logger.elasticsearch
const got = require('got')
const request = got.extend({
  timeout: elasticConfig.timeout,
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
    if (elasticConfig.enabled === false) {
      logger.log('elasticsearch submit disabled from system configuration')
      return
    }

    if (!config || config.enabled !== true) {
      logger.log('customer elasticsearch integration is not enabled')
      return
    }

    if (!isURL(config.url)) {
      logger.error('customer elasticsearch logger url is not valid')
      return
    }

    // build elasticsearch index
    let indexDate = payload.date.split('T')[0].replace(/-/g,'.')
    let url = `${config.url}/theeye-${topic}-${indexDate}/_doc`

    request
      .post(url, { body: JSON.stringify(payload) })
      .catch(err => {
        logger.error('Request Error %s', err.message)
        logger.data('Error data sent %j', payload)
        //
        // INVALID ! MUST DISABLE INTEGRATION
        //
      })
  }
}
