"use strict";

const path = require('path');
const extend = require('util')._extend;
const CustomerService = require('../service/customer');
const logger = require('./logger')(':elastic');
const config = require('config');
const fs = require('fs');

var request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
});

module.exports = {
  submit (customerName,key,data) {
    CustomerService.getCustomerConfig(
      { name: customerName },
      function(err,config){
        var specs;
        var elastic = config.elasticsearch;

        if (err||!config) {
          return logger.error('FATAL - no config found. elasticsearch submit will fail');
        }

        if (!elastic) {
          return logger.error('FATAL - no config. elasticsearch config key not set');
        }

        if (!elastic.url) {
          return logger.error('ERROR - invalid elasticsearch url configuration.');
        }

        data.type = key;
        data.timestamp||(data.timestamp = (new Date()).getTime());
        data.date||(data.date = (new Date()).toISOString());
        specs = {
          url: elastic.url + '/' + path.join(customerName,key),
          body: data
        }

        if (elastic.enabled===true) {
          request.post(specs,(err,respose,body) => {
            if (err) {
              logger.error('ERROR %s',err);
              logger.error(arguments);
              return;
            }
            logger.log('submit done to %s', specs.url);
          });
        } else {
          logger.log('elasticsearch is not enabled');
        }

        if (elastic.debug===true) {
          logger.log('elasticsearch debug enabled');
          debug(elastic.debug_file,specs);
        }
      }
    );
  }
}

function debug (filename, data) {
  if (!filename) return logger.error('no filename provided');
  fs.appendFile(filename, JSON.stringify(data) + "\n", (err) => {
    if (err) { logger.error(err); }
  }); 
}
