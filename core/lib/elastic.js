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

      data.topic = topic 
      data.timestamp = (new Date()).getTime()
      data.date = (new Date()).toISOString()
      specs = {
        url: elastic.url + '/' + path.join(customerName, topic),
        body: data
      }

      if (elastic.enabled===true) {
        if (isURL(elastic.url)) {
          request.post(specs,(err,respose,body) => {
            if (err) {
              logger.error('Request Error %s', err.message)
              logger.data('Error data sent %j', specs)
              return;
            }
            logger.log('submit done to %s', specs.url);
          })
        } else {
          logger.error('customer elasticsearch configuration url is not valid')
        }
      } else {
        logger.log('customer elasticsearch integration is not enabled')
      }

      // dump audit data to file
      if (elastic.dump === true && elastic.dump_file) {
        logger.log('elk data dump enabled')
        dump(elastic.dump_file, specs)
      }
    })
  }
}

const dump = (filename, data) => {
  if (!filename) {
    return logger.error('no filename provided')
  }

  fs.appendFile(
    filename,
    JSON.stringify(data) + "\n",
    (err) => {
      if (err) {
        logger.error(err)
      }
    }
  )
}
