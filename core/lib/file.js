'use strict';

const logger = require('./logger')('lib:file')
const storage = require('./storage').get()
const filenameRegexp = /^[A-Za-z0-9._][0-9a-zA-Z-_.]*$/

function isValidFilename (filename) {
  if (!filename) { return false }
  return filenameRegexp.test(filename)
}

function keynamegen (filename) {
  return filename + '[ts:' + Date.now() + ']'
}

module.exports = {
  /**
   *
   * replace a file already created in the current active store
   *
   */
  replace (input,next) {
    var specs
    var pathname = input.pathname
    var file = input.file // mongoose model file
    var source = input.source // multer file
    var keyname = keynamegen(source.name)

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
    })
  },
  /**
   * create a new file in the storage from it's content
   * @param {} input
   * @property {} input.storename
   * @property {} input.filename
   * @property {} input.text
   */
  storeText (input, next) {
    let filename = input.filename

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    let keyname = keynamegen(filename)

    storage.save({
      filename: keyname,
      storename: input.storename,
      sourceOrigin: 'text',
      sourceContent: input.text
    }, function (err, data) {
      if (err) {
        logger.error('unable to store files')
        logger.error(err.message)
        if (next) { next(err) }
      } else {
        logger.log('file stored')

        data.keyname = keyname
        if (next) { next(null, data) }
      }
    })
  },
  /**
   * create a new file in the storage from an existent file. copy file
   * @param {} input
   * @property {} input.storename
   * @property {} input.filename
   * @property {} input.filepath
   */
  storeFile (input, next) {
    let filename = input.filename

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    let keyname = keynamegen(filename)

    storage.save({
      filename: keyname,
      storename: input.storename,
      sourceOrigin: 'file',
      sourcePath: input.filepath
    }, function (error, data) {
      data.keyname = keyname

      if (error) {
        logger.error('unable to store files')
        logger.error(error.message)
        if (next) { next(error) }
      } else {
        logger.log('file stored')
        if (next) { next(null, data) }
      }
    })
  },
  /**
   *
   *
   */
  getStream (file, next) {
    return storage.getStream(
      file.keyname,
      file.customer_name,
      next
    )
  },
  getBuffer (file, next) {
    logger.log('obtaining file from storage')
    this.getStream(file, (err, readstream) => {
      if (err) { return next(err) }

      var bufs = []
      readstream.on('error', function(err){
        logger.error(err)
        next(err)
        readstream.destroy()
      })
      readstream.on('data', function(data){
        bufs.push(data)
      })
      // no more data to consume
      readstream.on('end', function(){
        var buf = Buffer.concat(bufs)
        logger.log('file data consumed')
        next(null,buf)
      })
      // stream consumed totally or terminated
      readstream.on('close', function(){
        logger.log('file stream closed')
      })
    })
  }
}
