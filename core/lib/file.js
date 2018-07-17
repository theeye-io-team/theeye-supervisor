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
   * @summary replace a file already created in the current active store
   * @param {Object} input
   * @property {File} input.model mongoose file
   * @property {String} input.filename uploaded file name
   * @property {String} input.filepath uploaded file current location
   * @property {String} input.storename file target store
   *
   */
  replace (input, next) {
    let { filename } = input
    let keyname = keynamegen(filename)

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    // filename has changed
    if (input.model.filename !== filename) {
      logger.log('new file uploaded. removing old one')
      storage.remove(input.model)
    }

    storage.save({
      filename: keyname,
      storename: input.storename,
      sourceOrigin: 'file',
      sourcePath: input.filepath
    }, function (err, data) {
      if (err) {
        logger.error('unable to store files')
        logger.error(err.message)
        return next(err)
      } else {
        logger.log('file stored')
        data.keyname = keyname
        if (next) { next(null, data) }
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
    let keyname = keynamegen(filename)

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

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
   * create a new file in the storage from an existent file (filecopy)
   * @param {} input
   * @property {} input.storename
   * @property {} input.filename
   * @property {} input.filepath
   */
  storeFile (input, next) {
    let filename = input.filename
    let keyname = keynamegen(filename)

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    storage.save({
      filename: keyname,
      storename: input.storename,
      sourceOrigin: 'file',
      sourcePath: input.filepath
    }, function (error, data) {
      if (error) {
        logger.error('unable to store files')
        logger.error(error.message)
        if (next) { next(error) }
      } else {
        logger.log('file stored')
        data.keyname = keyname
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
