var fs = require('fs');
var debug = require('debug')('env');

function setenv(next) {

  if( ! process.env.NODE_ENV ) {
    console.error('NODE_ENV is required');
    return process.exit(-1);
  }

  var config = require('config');

  if( ! config.get("is_dev") ) {
    debug('seting up aws config');
    debug(config.get('aws'));
    var AWS = require('aws-sdk'); 
    AWS.config.update( config.get('aws') );
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

  next();
}

exports.setenv = setenv ;
