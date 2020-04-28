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
    var driver = config.storage.driver
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
    //var file = input.script
    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      params: {
        Bucket: config.integrations.aws.s3.bucket,
        Key: input.filename // keyname ?
      }
    })

    let body
    if (input.sourceOrigin === 'file') {
      body = fs.createReadStream(input.sourcePath).pipe(zlib.createGzip())
    } else if (input.sourceOrigin === 'text') {
      var str = new Stream.PassThrough()
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
   * @param {Object} input
   * @property {String} input.key
   */
  remove (input, next) {
    next || (next = () =>{})

    let params = {
      Bucket: config.integrations.aws.s3.bucket,
      Key: input.key
    }

    var s3 = new AWS.S3({ params })
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
  getStream (key, customer_name, next) {
    const params = {
      Bucket: config.integrations.aws.s3.bucket,
      Key: key
    }

    const s3 = new AWS.S3({ params })

    s3.getObject(params)
    .on('error', function (err) {
      debug('s3 get error. %s', err)
      next(err)
    })
    .createReadStream()
    .pipe( zlib.createGunzip() )
    .on('error', function (err) {
      debug('gzip error. %s', err)
      next(err)
    })
    .on('finish', function () {
      next(null, this)
    })
  }
}

const LocalStorage = {
  createLocalStorage (name, next) {
    debug('creating local storage');

    var basePath = systemConfig.file_upload_folder ;
    var storagePath = basePath + '/' + name ;
    var scriptsPath = storagePath + '/scripts' ;

    fs.exists(scriptsPath, function(exists) {
      if (exists) {
        next(scriptsPath);
      } else {
        fs.exists(storagePath, function(exists) {
          if (!exists) {
            fs.mkdirSync(storagePath, '0755');
            debug('named storage %s directory created', storagePath);

            fs.mkdirSync(scriptsPath, '0755');
            debug('files storage %s directory created', scriptsPath);

            next(scriptsPath);
          } else {
            fs.exists(scriptsPath, function(exists) {
              if (!exists) {
                fs.mkdirSync(scriptsPath, '0755');
                debug('file storage %s directory created', scriptsPath);
              }
              next(scriptsPath);
            });
          }
        });
      }
    });
  },
  /**
   * @param {Object} input
   * @property {String} input.filename
   * @property {String} input.storename
   * @property {String} input.sourceOrigin source origin can be 'text' or 'file'
   * @property {String} input.sourcePath if source is 'file', this is the original file
   * @property {String} input.sourceContent if source is 'text', this is the content
   */
  save (input, next) {
    const self = this
    const filename = input.filename
    const storename = input.storename
    //let file = input.script

    this.createLocalStorage(storename, function (storagePath) {
      let targetPath = path.join(storagePath, filename)
      if (input.sourceOrigin === 'file') {
        copyFile(input.sourcePath, targetPath, function (error) {
          if (error) {
            debug(error)
            next(error)
          } else {
            next(null, { path: targetPath, filename })
          }
        })
      } else if (input.sourceOrigin === 'text') {
        createFile(input.sourceContent, targetPath, function (error) {
          if (error) {
            debug(error)
            next(error)
          } else {
            next(null, { path: targetPath, filename })
          }
        })
      } else {
        // errr ?
      }
    })
  },
  getStream (key, customer_name, next) {
    debug('creating file stream');
    var self = this;
    var storagePath = systemConfig.file_upload_folder;
    var customerPath = storagePath + '/' + customer_name;
    var scriptsPath = customerPath + '/scripts';
    var filepath = path.join(scriptsPath, key);
    var storeName = customer_name;

    fs.access(filepath, fs.R_OK, function(err){
      if(err){
        if(err.code=='ENOENT'){
          self.createLocalStorage(storeName,function(path){
            fs.writeFile(filepath,'EMPTY FILE CREATED',function(err){
              if(err) return next(err);
              next(null,fs.createReadStream(filepath));
            });
          });
        }
        else return next(err);
      }
      else return next(null,fs.createReadStream(filepath));
    });
  },
  remove (file, next) {
    // not implemented
    debug('REMOVE NOT IMPLEMENTED');
    if(next) next();
  }
}

const createFile = (content, target, cb) => {
  fs.writeFile(target, content, cb)
}

const copyFile = (source, target, cb) => {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}
