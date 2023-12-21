
const logger = require('./logger')('lib:file')
const storage = require('./storage').get()
const filenameRegexp = /^[A-Za-z0-9._][0-9a-zA-Z-_.]*$/
const path = require('path')

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
    const { filename } = input

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    const keyname = keynamegen(filename)
    const key = `${input.storename}/${input.pathname}/${keyname}`
    storage.save({
      key,
      sourceOrigin: 'file',
      sourcePath: input.filepath
    }, function (err, data) {
      if (err) {
        logger.error('unable to store files')
        logger.error(err.message)
        return next(err)
      } else {
        logger.log('file stored')
        data.storage_key = key
        if (next) { next(null, data) }
      }
    })

    // filename has changed
    //if (input.model.filename !== filename) {
    //  logger.log('new file uploaded. removing old one')
    //  storage.remove(input.model)
    //}
  },
  /**
   * create a new file in the storage from it's content
   * @param {} input
   * @property {} input.storename
   * @property {} input.filename
   * @property {} input.text
   */
  storeText (input, next) {
    const { filename } = input
    const keyname = keynamegen(filename)
    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    const key = `${input.storename}/${input.pathname}/${keyname}`
    storage.save({
      key,
      sourceOrigin: 'text',
      sourceContent: input.text
    }, function (err, data) {
      if (err) {
        logger.error('unable to store files')
        logger.error(err.message)
        if (next) { next(err) }
      } else {
        logger.log('file stored')
        data.storage_key = key
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
    const { filename } = input

    if (!isValidFilename(filename)) {
      var error = new Error('invalid filename')
      error.statusCode = 400
      return next(error)
    }

    const keyname = keynamegen(filename)
    const key = `${input.storename}/${input.pathname}/${keyname}`
    storage.save({
      key,
      sourceOrigin: 'file',
      sourcePath: input.filepath
    }, function (error, data) {
      if (error) {
        logger.error('unable to store files')
        logger.error(error.message)
        if (next) { next(error) }
      } else {
        logger.log('file stored')
        data.storage_key = key
        if (next) { next(null, data) }
      }
    })
  },
  /**
   *
   *
   */
  getStream (file, next) {
    // keep backward compatibility
    let key
    if (file.storage_key) {
      // then it has a unified storage key
      key = file.storage_key
    } else {
      // old file format. data migration is needed
      key = path.join(file.customer_name, 'scripts', file.keyname)
    }

    storage.getStream(key, next)
  },
  getBuffer (file, next) {
    logger.log('obtaining file from storage')
    this.getStream(file, (err, readstream) => {
      if (err) { return next(err) }

      const parts = []
      readstream.on('error', (err) => {
        logger.error(err)
        next(err)
        readstream.destroy()
      })
      readstream.on('data', (data) => {
        parts.push(data)
      })
      // no more data to consume
      readstream.on('end', () => {
        const buf = Buffer.concat(parts)
        logger.log('file data consumed')
        next(null,buf)
      })
      // stream consumed totally or terminated
      readstream.on('close', () => {
        logger.log('file stream closed')
      })
    })
  },
  async remove (file) {
    return new Promise((resolve, reject) => {
      let key
      if (file.keyname) {
        // old file format. data migration is needed
        key = path.join(file.customer_name, 'scripts', file.keyname)
      } else {
        // then it has a unified storage key
        key = file.storage_key
      }

      storage.remove(key, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

const isValidFilename = (filename) => {
  if (!filename) { return false }
  return filenameRegexp.test(filename)
}

const keynamegen = (key) => {
  const ts = Date.now()
  return `${key}_${ts}`
}

