"use strict";

const path = require('path');

const extend = require('util')._extend;
const CustomerService = require('../service/customer');
const logger = require('./logger')(':elastic');

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

        if(err||!config) return logger.error('no config. elastic search submit failed');

        //
        // do not use prefix , it changes the sns keys and breaks the comunication with the clients
        //
        //var prefix = config.elasticsearch.keys.prefix
        //if( prefix ) key = prefix + key ;
        var elastic = config.elasticsearch;
        if(!elastic){
          return logger.error('FATAL - elastic config key not set');
        }

        if( elastic.enabled === false ){
          logger.log('elastic search disabled by config');
          return;
        }

        if( ! elastic.url ){
          return logger.error('ERROR invalid elasticsearch configuration.');
        }

        data.type = key;
        data.timestamp || ( data.timestamp = (new Date()).getTime() );
        data.date || ( data.date = (new Date()).toISOString() );

        var url = elastic.url + '/' + path.join(customerName,key);

        request.post({
          url: url,
          body: data
        },function(err,respose,body){
          if(err) {
            logger.error('ERROR %s',err);
            logger.error(arguments);
            return;
          }
          logger.log('submit done to %s', url);
        });
      });
  }
}
