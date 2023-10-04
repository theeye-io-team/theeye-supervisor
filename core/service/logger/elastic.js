const App = require('../../app')
const logger = require('../../lib/logger')(':logger:elasticsearch')
const isURL = require('validator/lib/isURL')

const globalElasticConfig = require('config').logger.elasticsearch
const got = require('got')
const request = got.extend({
  timeout: globalElasticConfig.timeout,
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
  submit (customer, topic, payload) {
    // global settings
    if (globalElasticConfig.enabled === false) {
      logger.log('elasticsearch submit disabled from system configuration')
      return
    }

    const { elasticsearch } = customer.config

    if (!elasticsearch || elasticsearch.enabled !== true) {
      logger.log('customer elasticsearch integration is not enabled')
      return
    }

    // build elasticsearch index
    const indexDate = payload.date.split('T')[0].replace(/-/g,'.')
    const url = `${elasticsearch.url}/theeye-${topic}-${indexDate}/_doc`

    return request.post(url, { body: JSON.stringify(payload) })
      .catch(err => {
        logger.error('Request Error %s', err.message)
        logger.data('Error data sent %j', payload)

        customer.config.elasticsearch.enabled = false
        customer.markModified('config')
        customer.save()
          .then(() => logger.error('elasticsearch integration disabled'))
          .catch(err => logger.error('elasticsearch integration unable to update'))
      })
  }
}
