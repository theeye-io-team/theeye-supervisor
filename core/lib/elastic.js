"use strict";

const isURL = require('validator/lib/isURL')
const path = require('path')
const extend = require('util')._extend
const CustomerService = require('../service/customer')
const logger = require('./logger')(':elastic')
const fs = require('fs')
const gconfig = require('config').elasticsearch
const request = require("request").defaults({
  timeout: gconfig.timeout,
  json: true,
  gzip: true
})

module.exports = {
  /**
   * @param {String} customerName
   * @param {String} topic 
   * @param {Object} data
   */
  submit (customerName, topic, data) {
    if (!customerName) {
      let err = new Error('customerName is required to submit elk')
      err.context = { customerName, topic, data }
      logger.error('%o', err)
      return
    }

    const filters = { name: customerName }
    CustomerService.getCustomerConfig(filters, (err,config) => {

      if (gconfig.enabled===false) { // global elasticsearch settings
        logger.error('ABORTED. elasticsearch disabled by system config')
        return
      }

      var specs
      var elastic

      if (err) {
        logger.error('ERROR. fetching customer configuration.')
        logger.error(err.message)
        return
      }
      
      if (!config) {
        logger.error('ABORTED. customer configuration not found.')
        return
      }

      if (!config.elasticsearch) {
        logger.error('ABORTED. customer elasticsearch integration not set.')
        return
      }

      elastic = config.elasticsearch

      let payload = Object.assign({}, data)
      // force required properties by elasticsearch in payload
      payload.organization = data.organization || customerName
      payload.timestamp = (new Date()).getTime()
      payload.date = (new Date()).toISOString()

      let indexDate = new Date().toISOString().split('T')[0].replace(/-/g,'.')
      let index = `theeye-${topic}-${indexDate}`
      let _type = '_doc'

      specs = {
        url: `${elastic.url}/${index}/${_type}`,
        body: payload
      }

      if (elastic.enabled===true) {
        if (isURL(elastic.url)) {
          request.post(specs,(err,response,body) => {
            if (err) {
              logger.error('Request Error %s', err.message)
              logger.data('Error data sent %j', specs)
              return;
            }

            dump(elastic.dump, elastic.dump_file, { specs, response: body })
          })
        } else {
          logger.error('customer elasticsearch configuration url is not valid')
        }
      } else {
        logger.log('customer elasticsearch integration is not enabled')
        dump(elastic.dump, elastic.dump_file, { specs })
      }

    })
  }
}

const dump = (dump, filename, payload) => {
  if (!dump) return
  logger.log('elk data dump enabled')
  logger.data('payload %j', payload)

  if (!filename) return
  fs.appendFile(
    filename,
    JSON.stringify(payload) + "\n",
    (err) => {
      if (err) {
        logger.error(err)
      }
    }
  )
}
