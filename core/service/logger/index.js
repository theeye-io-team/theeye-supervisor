const fs = require('fs')
const App = require('../../app')
const logger = require('../../lib/logger')(':logger')
const config = require('config')

const elastic = require('./elastic')
const remote = require('./remote')
//const fluent = require('./fluent')

module.exports = {
  async submit (customer_name, topic, data) {
    if (!customer_name) {
      let err = new Error('customer name is required')
      err.context = { customer_name, topic, data }
      logger.error('%o', err)
      throw err
    }

    let customerConfig = await getCustomerConfig(customer_name)

    // force required properties in payload
    let date = new Date()
    let payload = Object.assign({ topic }, data)
    payload.organization = customer_name
    payload.timestamp = date.getTime()
    payload.date = date.toISOString()

    dump(config.logger, payload)

    elastic.submit(customerConfig.elasticsearch, topic, payload)
    remote.submit(customerConfig.remote_logger, topic, payload)
  }
}

const getCustomerConfig = (customer_name) => {
  return new Promise((resolve, reject) => {
    App.customer.getCustomerConfig({ name: customer_name }, (err, customerConfig) => {
      if (err) {
        logger.error('failed to fetch customer configuration.')
        logger.error(err.message)
        return reject(err)
      }

      if (!customerConfig) {
        // customer not configured. abort
        logger.log('customer configuration not set.')
        return resolve(null)
      }

      resolve(customerConfig)
    })
  })
}

const dump = (config, payload) => {
  if (config.dump.enabled !== true) { return }

  logger.log('logger data dump enabled')
  logger.data('payload %j', payload)

  if (!config.dump.filename) { return }

  fs.appendFile(
    config.dump.filename,
    JSON.stringify(payload) + "\n",
    (err) => {
      if (err) {
        logger.error(err)
      }
    }
  )
}
