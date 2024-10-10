const AWS = require('aws-sdk')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')
const debug = require('debug')('eye:lib:store')
const config = require('config')
const systemConfig = config.get('system')
const stream = require('stream')

module.exports = {
  get () {
    const driver = config.storage.driver
    return (driver === 'local') ? LocalStorage : S3Storage()
  }
}

const S3Storage = () => {

  const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: config.integrations.aws.s3.region
  })

  return {
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
      //var file = input.script

      let body
      if (input.sourceOrigin === 'file') {
        body = fs.createReadStream(input.sourcePath).pipe(zlib.createGzip())
      } else if (input.sourceOrigin === 'text') {
        var str = new stream.PassThrough()
        str.write(input.sourceContent)
        str.end()
        body = str.pipe(zlib.createGzip())
      }

      const params = {
        Body: body,
        Bucket: config.integrations.aws.s3.bucket,
        Key: input.filename // keyname ?
      }

      s3.upload(params)
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
     * @param {Object} input
     * @property {String} input.key
     */
    remove (file, next) {
      next || (next = () =>{})
      const { keyname } = file

      if (!keyname) {
        return next( new Error('undefined keyname') )
      }

      const params = {
        Bucket: config.integrations.aws.s3.bucket,
        Key: file.keyname
      }

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
    async getStream (key) {
      const params = {
        Bucket: config.integrations.aws.s3.bucket,
        Key: key
      }

      const getObject = promisify(s3.getObject).bind(s3)
      const resp = await getObject(params)

      const readstream = new stream.Readable()
      readstream.push(resp.Body)
      readstream.push(null)
      return readstream.pipe(zlib.createGunzip())
    }
  }
}

const LocalStorage = {
  /**
   * @param {Object} input
   * @property {String} input.filename
   * @property {String} input.storename
   * @property {String} input.sourceOrigin source origin can be 'text' or 'file'
   * @property {String} input.sourcePath if source is 'file', this is the original file
   * @property {String} input.sourceContent if source is 'text', this is the content
   */
  save (input, next) {
    try {
      const { filename, storename, sourceOrigin } = input
      const storagePath = ensureNamedStorageExists(storename)

      const targetPath = path.join(storagePath, filename)
      if (sourceOrigin === 'file') {
        fs.copyFileSync(input.sourcePath, targetPath)
      } else if (sourceOrigin === 'text') {
        fs.writeFileSync(targetPath, input.sourceContent)
      } else {
        throw new Error('unhandled sources origin received')
      }

      next(null, { path: targetPath, filename })
    } catch (err) {
      next( err )
    }
  },
  async getStream (key, customerName) {
    const storagePath = systemConfig.file_upload_folder
    let filepath

    try {
      filepath = path.join(storagePath, customerName, 'scripts', key)
      fs.accessSync(filepath, fs.R_OK)
    } catch (err) {
      // file is not found in the storage
      if (err.code === 'ENOENT') {
        const storage = ensureNamedStorageExists(customerName)
        fs.writeFileSync(filepath, 'EMPTY FILE CREATED')
      } else {
        //break
        throw err
      }
    }

    return fs.createReadStream(filepath)
  },
  remove (file, next) {
    next || (next = (() => {}))

    const storagePath = systemConfig.file_upload_folder
    try {
      const filepath = path.join(storagePath, file.customer_name, 'scripts', file.keyname)
      fs.rmSync(filepath)
      next()
    } catch (err) {
      next(err)
    }
  }
}

const ensureNamedStorageExists = (storename) => {
  debug('creating local storage')

  const basePath = systemConfig.file_upload_folder
  const storagePath = path.join(basePath, storename)
  const scriptsPath = path.join(storagePath, 'scripts')

  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, '0755')
    debug('named storage %s created', storagePath)
  }

  if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath, '0755')
    debug('scripts storage %s created', scriptsPath)
  }

  return scriptsPath
}
