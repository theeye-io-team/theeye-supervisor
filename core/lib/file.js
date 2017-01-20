'use strict';

const storage = require('./storage').get();
const logger = require('./logger')('lib:file');

const filenameRegexp = /^[a-z0-9._][0-9a-zA-Z-_.]*$/;
function isValidFilename (filename) {
  if (!filename) return false;
  return filenameRegexp.test(filename);
}

function keynamegen (filename) {
  return filename + '[ts:' + Date.now() + ']' ;
}

module.exports = {
  store (input, next) {
    var file = input.file;
    var keyname = keynamegen(file.name);
    file.keyname = keyname;

    if (!isValidFilename(file.name)) {
      var error = new Error('invalid filename');
      error.statusCode = 400;
      return next(error);
    }

    var specs = {
      script: file,
      customer_name: input.pathname 
    };

    storage.save(specs,function(error,data){
      data.keyname = keyname;

      if (error) {
        logger.error('unable to store files');
        logger.error(error.message);
        if (next) next(error);
      } else {
        logger.log('file stored');
        if (next) next(null,data);
      }
    });
  }
};
