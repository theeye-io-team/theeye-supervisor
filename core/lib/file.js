'use strict';

const storage = require('./storage').get();
const logger = require('./logger')('lib:file');


function keyname (filename) {
  return filename + '[ts:' + Date.now() + ']' ;
}

module.exports = {
  create (file, next) {
    var buf = fs.readFileSync(file.path),
      specs = {
        key: keyname(file.name),
        path: file.path
      };

    storage.save(specs,function(error,data){
      if (error) {
        logger.error('unable to store files');
        logger.error(error.message);
        if (next) next(error);
      } else {
        logger.log('file stored');
        if (next) next(null);
      }
    });
  }
};
