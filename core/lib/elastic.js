"use strict";

const isURL = require('validator/lib/isURL')
const path = require('path')
const extend = require('util')._extend
const CustomerService = require('../service/customer')
const logger = require('./logger')(':elastic')
const fs = require('fs')
const request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
})

module.exports = {
  /**
   * @param {String} customerName
   * @param {String} key
   * @param {Object} data
   */
  submit (customerName, key, data) {
    const query = { name: customerName }
    CustomerService.getCustomerConfig(query, (err,config) => {
      var specs, elastic

      if (err||!config) {
        logger.error('customer elasticsearch configuration not found. elasticsearch submit aborted')
        return
      }

      if (!config.elasticsearch) {
        logger.error('customer elasticsearch configuration key not set. elasticsearch submit aborted')
        return
      }

      elastic = config.elasticsearch
      data.type = key
      data.timestamp || (data.timestamp = (new Date()).getTime())
      data.date || (data.date = (new Date()).toISOString())
      specs = {
        url: elastic.url + '/' + path.join(customerName,key),
        body: data
      }

      if (elastic.enabled===true) {
        if (isURL(elastic.url)) {
          request.post(specs,(err,respose,body) => {
            if (err) {
              logger.error('Request Error : %j', err);
              logger.error('Error data sent: %j', specs);
              return;
            }
            logger.log('submit done to %s', specs.url);
          })
        } else {
          logger.error('customer elasticsearch configuration url invalid')
        }
      } else {
        logger.log('customer elasticsearch service disabled')
      }

      if (process.env.NODE_ENV='development' && elastic.debug===true) {
        logger.log('elasticsearch debug enabled')
        debug(elastic.debug_file,specs)
      }
    })
  }
}

const debug = (filename, data) => {
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
