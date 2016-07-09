var AWS = require('aws-sdk');
var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var debug = require('debug')('eye:supervisor:lib:store');

var config = require("config");
var systemConfig = config.get('system');

var S3Storage = {
  save : function(input,next)
  {
    var params = {
      'Bucket': config.get('s3').bucket,
      'Key': input.script.keyname
    };

    var s3obj = new AWS.S3({ params : params });

    var body = fs
    .createReadStream( input.script.path )
    .pipe( zlib.createGzip() );

    s3obj.upload({ Body : body })
    .on('httpUploadProgress', function(evt) {
      debug('upload progress %j', evt); 
    })
    .send(function(error, data) {
      if(error) {
        debug('failed to create s3 script');
        debug(error.message);
        if(next) next(error,null);
      } else {
        if(next) next(null,data);
      }
    });
  },
  remove : function(script,next)
  {
    if(!next) next = function(){};

    var params = {
      'Bucket': config.get('s3').bucket,
      'Key': script.name
    };

    var s3 = new AWS.S3({ params : params });
    s3.deleteObject(params, function(error, data) {
      if(error){
        debug('failed to remove s3 script');
        debug(error.message);
        next(error);
      } else {
        next(null,data);
      }
    });
  },
  getStream: function(key,customer_name,next)
  {
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

var LocalStorage = {
  createCustomerScriptsPath : function(customer_name, next) {
    debug('creating customer script path');

    var storagePath = systemConfig.file_upload_folder ;
    var customerPath = storagePath + '/' + customer_name ;
    var scriptsPath = customerPath + '/scripts' ;

    fs.exists(scriptsPath, function(exists) {
      if(exists) {
        next(scriptsPath);
      } else {
        fs.exists(customerPath, function(exists) {
          if( ! exists ) {
            debug('customer %s directory created', customer_name);
            fs.mkdirSync(customerPath, 0755);

            debug('customer %s scripts directory created', customer_name);
            fs.mkdirSync(scriptsPath, 0755);

            next(scriptsPath);
          } else {
            fs.exists(scriptsPath, function(exists) {
              if( ! exists ) {
                debug('customer %s scripts directory created', customer_name);
                fs.mkdirSync(scriptsPath, 0755);
              }
              next(scriptsPath);
            });
          }
        });
      }
    });
  },
  save : function(input,next)
  {
    var self = this ;

    var script = input.script;
    var scriptName = script.keyname;
    var currentPath = script.path;

    this.createCustomerScriptsPath(
      input.customer_name,
      function(scriptsPath) {
        fs.rename(
          currentPath,
          path.join(scriptsPath, scriptName),
          function(error) {
            if(error) {
              debug(error);
              next(error,null);
            }
            else next();
          }
        );
      }
    );
  },
  getStream : function(key,customer_name,next)
  {
    debug('getting script stream');
    var self = this;
    var storagePath = systemConfig.file_upload_folder;
    var customerPath = storagePath + '/' + customer_name;
    var scriptsPath = customerPath + '/scripts';
    var filepath = path.join(scriptsPath, key);

    fs.access(filepath, fs.R_OK, function(err){
      if(err){
        if(err.code=='ENOENT'){
          self.createCustomerScriptsPath(customer_name,function(path){
            fs.writeFile(filepath,"EMPTY FILE CREATED",function(err){
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
  remove : function(script,next)
  {
    // not implemented
    debug('REMOVE NOT IMPLEMENTED');
    if(next) next();
  }
};

module.exports = {
  S3: S3Storage,
  Local: LocalStorage
};
