const fs = require('fs')
require('./lib/error-extend');
const logger = require('./lib/logger')('app')

exports.setenv = function (next) {

  if (!process.env.NODE_ENV) {
    logger.error('NODE_ENV is required');
    return process.exit(-1);
  }

  var aws = require('config').integrations.aws

  if (aws.enabled===true) { // then configure AWS SDK
    logger.log('configuring aws integration')
    var AWS = require('aws-sdk')
    AWS.config.update( aws.config )
  }

  /**
  fs.exists( config.get("system").file_upload_folder , 
    function(exists) {
      if( !exists ) {
        fs.mkdirSync(config.system.file_upload_folder,0755);
      }
    }
  );
  */

  next()
}
