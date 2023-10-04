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

      const customer = await getCustomer(customer_name)
      const customerConfig = customer.config || {}

      // force required properties in payload
      const date = new Date()
      const payload = Object.assign({ topic }, data)
      payload.organization = customer_name
      payload.timestamp = date.getTime()
      payload.date = date.toISOString()

      dump(config.logger, payload)

      elastic.submit(customer, topic, payload)
      remote.submit(customer, topic, payload)
    } catch (err) {
      logger.error('%o', err)
    }
  }
}

const getCustomer = async (customer_name) => {
  const customer = await Customer.findOne({ name: customer_name })

  if (!customer) {
    const err = new Error('customer not found')
    err.filters = filters 
    throw err
  }

  return customer
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
