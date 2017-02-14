'use strict';

const logger = require('./logger')('lib:file');
const storage = require('./storage').get();
const filenameRegexp = /^[A-Za-z0-9._][0-9a-zA-Z-_.]*$/;

function isValidFilename (filename) {
  if (!filename) return false;
  return filenameRegexp.test(filename);
}

function keynamegen (filename) {
  return filename + '[ts:' + Date.now() + ']' ;
}

module.exports = {
  /**
   *
   * replace a file already created in the current active store
   *
   */
  replace (input,next) {

    var specs,
      pathname = input.pathname,
      file = input.file, // mongoose file
      source = input.source; // multer file
    var keyname = keynamegen(source.name);

    if (!file||!source) {
      var error = new Error('file required');
      error.statusCode = 400;
      return next(error);
    }

    if (!isValidFilename(source.name)) {
      var error = new Error('invalid filename');
      error.statusCode = 400;
      return next(error);
    }

    // filename has changed
    if (file.filename!=source.name) {
      logger.log('new file uploaded. removing old one');
      storage.remove(file);
    }

    source.keyname = keyname;
    specs = {
      script: source,
      customer_name: pathname 
    }

    storage.save(specs,function(err,data){
      data.keyname = keyname;

      if (err) {
        logger.error('cannot save script into storage');
        logger.error(err);
        return next(err);
      } else {
        return next(null, data);
      }
    });
  },
  /**
   *
   * create new file in the current active store
   *
   */
  store (input, next) {
    var specs,
      pathname = input.pathname,
      source = input.source;

    var keyname = keynamegen(source.name);
    source.keyname = keyname;

    if (!isValidFilename(source.name)) {
      var error = new Error('invalid filename');
      error.statusCode = 400;
      return next(error);
    }

    specs = {
      script: source,
      customer_name: pathname 
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
  },
  getStream: function(file,next) {
    return storage.getStream(
      file.keyname,
      file.customer_name,
      next
    );
  }
};
