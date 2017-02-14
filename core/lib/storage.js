'use strict';

const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const debug = require('debug')('lib:store');
const config = require('config');
const systemConfig = config.get('system');

var S3Storage = {
  save : function(input,next) {
    var file = input.script;
    var params = {
      Bucket: config.get('s3').bucket,
      Key: file.keyname
    };

    var s3 = new AWS.S3({ params : params });

    var body = fs
      .createReadStream( file.path )
      .pipe( zlib.createGzip() );

    s3.upload({ Body : body })
      .on('httpUploadProgress', function(evt) {
        debug('upload progress %j', evt); 
      })
      .send(function(error, data) {
        if(error) {
          debug('failed to create file in s3');
          debug(error.message);
          if(next) next(error,null);
        } else {
          if(next) next(null,data);
        }
      });
  },
  remove : function(file,next) {
    if(!next) next = function(){};

    var params = {
      'Bucket': config.get('s3').bucket,
      'Key': file.name
    };

    var s3 = new AWS.S3({ params : params });
    s3.deleteObject(params, function(error, data) {
      if(error){
        debug('failed to remove file from s3 ');
        debug(error.message);
        next(error);
      } else {
        next(null,data);
      }
    });
  },
  getStream: function(key,customer_name,next) {
    var params = {
      'Bucket': config.get('s3').bucket,
      'Key': key
    };

    var s3 = new AWS.S3({ params: params });

    s3.getObject(params)
    .on('error',function(error){
      next(error);
    })
    .createReadStream()
    .pipe( zlib.createGunzip() )
    .on('error',function(error){
      next(error);
    })
    .on('finish',function(){
      next(null,this);
    });
  }
};


function copyFile(source, target, cb) {
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

var LocalStorage = {
  createLocalStorage : function(name, next) {
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
  save : function(input,next) {
    var self = this, targetPath,
      file = input.script,
      filename = file.keyname,
      currentPath = file.path,
      storeName = input.customer_name;

    this.createLocalStorage(
      storeName,
      function(storagePath) {
        targetPath = path.join(storagePath, filename);

        copyFile(currentPath,targetPath,function(error){
          if (error) {
            debug(error);
            next(error,null);
          } else {
            next(null,{
              path: targetPath,
              filename: filename 
            });
          }
        });
      }
    );
  },
  getStream : function(key,customer_name,next) {
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
  remove : function(file,next) {
    // not implemented
    debug('REMOVE NOT IMPLEMENTED');
    if(next) next();
  }
};

module.exports = {
  get () {
    var driver = config.get('storage').driver;
    return driver === 'local' ? LocalStorage : S3Storage ;
  }
}
