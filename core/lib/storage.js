const AWS = require('aws-sdk')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')
const debug = require('debug')('eye:lib:store')
const config = require('config')
const systemConfig = config.get('system')
const Stream = require('stream')

module.exports = {
  get () {
    const driver = config.storage.driver
    return driver === 'local' ? LocalStorage : S3Storage
  }
}

const S3Storage = {
  /**
   *
   * @param {Object} input
   * @property {String} input.filename
   * @property {String} input.storename
   * @property {String} input.sourceOrigin source origin can be 'text' or 'file'
   * @property {String} input.sourcePath if source is 'file', this is the original file
   * @property {String} input.sourceContent if source is 'text', this is the content
   *
   */
  save (input, next) {
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      params: {
        Bucket: config.integrations.aws.s3.bucket,
        Key: input.key
      }
    })

    let body
    if (input.sourceOrigin === 'file') {
      body = fs.createReadStream(input.sourcePath).pipe(zlib.createGzip())
    } else if (input.sourceOrigin === 'text') {
      const str = new Stream.PassThrough()
      str.write(input.sourceContent)
      str.end()
      body = str.pipe(zlib.createGzip())
    }

    s3.upload({ Body: body })
      .on('httpUploadProgress', function (evt) {
        debug('upload progress %j', evt)
      })
      .send(function (error, data) {
        if (error) {
          debug('failed to create file in s3')
          debug(error.message);
          if (next) { next(error, null) }
        } else {
          if (next) { next(null, data) }
        }
      })
  },
  /**
   * @param {Object} key
   */
  remove (key, next) {
    next || (next = () =>{})

    const params = {
      Bucket: config.integrations.aws.s3.bucket,
      Key: key
    }

    const s3 = new AWS.S3({ params })
    s3.deleteObject(params, function(error, data) {
      if (error) {
        debug('failed to remove file from s3 ');
        debug(error.message);
        next(error)
      } else {
        debug('file removed')
        debug(data)
        next(null, data)
      }
    });
  },
  getStream (key, next) {
    const params = {
      Bucket: config.integrations.aws.s3.bucket,
      Key: key
    }

    const s3 = new AWS.S3({ params })

    s3.getObject(params).createReadStream()
      .on('error', function (err) {
        debug('s3 get error. %s', err)
        return next(err)
      })
      .pipe( zlib.createGunzip() )
      .on('error', function (err) {
        debug('gzip error. %s', err)
        return next(err)
      })
      .on('finish', function () {
        return next(null, this)
      })
  }
}

const LocalStorage = {
  /**
   * @param {Object} input
   * @property {String} input.key full file pathname
   * @property {String} input.sourceOrigin source origin can be 'text' or 'file'
   * @property {String} input.sourcePath if source is 'file', this is the original file
   * @property {String} input.sourceContent if source is 'text', this is the content
   */
  save (input, next) {
    try {
      const { key } = input

      const targetPath = buildStorageFilename(key)

      if (input.sourceOrigin === 'file') {
        fs.copyFileSync(input.sourcePath, targetPath)
      } else if (input.sourceOrigin === 'text') {
        fs.writeFileSync(targetPath, input.sourceContent)
      } else {
        throw new Error('unhandled sources origin received')
      }

      next(null, { path: targetPath, filename: path.basename(targetPath) })
    } catch (err) {
      next( err )
    }
  },
  getStream (key, next) {
    const filename = buildStorageFilename(key)
    try {
      fs.accessSync(filename, fs.R_OK)
    } catch (err) {
      // file is not found in the storage
      if (err.code === 'ENOENT') {
        fs.writeFileSync(filename, 'EMPTY FILE CREATED')
      } else {
        //break
        return next(err)
      }
    }

    const stream = fs.createReadStream(filename)
    next(null, stream)
    return stream
  },
  remove (key, next) {
    try {
      const filename = buildStorageFilename(key)
      fs.accessSync(filename, fs.R_OK)
      fs.rmSync(filename)
      next()
    } catch (err) {
      next(err)
    }
  }
}

const buildStorageFilename = (key) => {
  const dirname = path.dirname(key)
  const basename = path.basename(key)

  const storagepath = ensureNamedStorageExists(dirname)

  const filename = path.join(storagepath, basename)
  return filename
}

const ensureNamedStorageExists = (pathname) => {
  debug('creating local storage')

  const basePath = systemConfig.file_upload_folder
  const storagePath = path.join(basePath, pathname)

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { mode: '0755', recursive: true })
    debug('named storage %s created', storagePath)
  }

  return storagePath
}

