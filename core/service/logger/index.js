const fs = require('fs')
const App = require('../../app')
const logger = require('../../lib/logger')(':logger')
const config = require('config')
const Customer = require('../../entity/customer').Entity

const elastic = require('./elastic')
const remote = require('./remote')
//const fluent = require('./fluent')

module.exports = {
  async submit (customer_name, topic, data) {
    try {
      if (!customer_name) {
        let err = new Error('customer name is required')
        err.context = { customer_name, topic, data }
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
    } catch (err) {
      logger.error('%o', err)
    }
  }
}

const getCustomerConfig = (customer_name) => {
  return new Promise((resolve, reject) => {
    Customer.findOne({ name: customer_name }, (error, customer) => {
      if (error) {
        logger.error(error)
        return resolve(error)
      }

      if (!customer) {
        const err = new Error('customer not found')
        err.filters = filters 
        logger.error('%o',err)
        return resolve(err)
      }

      resolve(customer.config || {})
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
