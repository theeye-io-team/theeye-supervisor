var Script = require(process.env.BASE_PATH + "/entity/script").Entity;
var Task = require(process.env.BASE_PATH + "/entity/task").Entity;
var logger = require('../lib/logger')('eye:supervisor:service:script');
var S3Storage = require('../lib/store').S3;
var LocalStorage = require('../lib/store').Local;
var async = require('async');
var md5 = require('md5');
var fs = require('fs');
var config = require('config');
var elastic = require('../lib/elastic');
var path = require('path');

var storageMedia = (function getStorageMedia(){
  return config.get("storage").driver == 'local' ?
    LocalStorage : S3Storage ;
})();


/**
 *
 * @author Facundo
 * @param
 *
 */
function updateScriptFile (file, script, doneFn) {
  if(file)
  {
    if(file.name != script.filename) {
      logger.log('new file uploaded. removing old one');
      file.keyname = getScriptKeyname(file.name);
      storageMedia.remove(script);
    } else {
      logger.log('replace old uploaded file');
      file.keyname = script.keyname;
    }

    var buf = fs.readFileSync(file.path);
    file.md5 = md5(buf) ;

    logger.log('saving file to media storage');
    storageMedia.save({
      'customer_name' : script.customer_name,
      'script' : file
    },function(error,data){
      if(error) {
        logger.error('cannot save script into storage');
        logger.error(error);
        return doneFn(error);
      }
      return doneFn(null, file);
    });
  }
  else doneFn();
}

function getScriptKeyname (filename)
{
  return filename + '[ts:' + Date.now() + ']' ;
}

function registerScriptCRUDOperation(customer,data) {
  var key = config.elasticsearch.keys.script.crud;
  elastic.submit(customer,key,data);
}


var Service = {
  create:function(input,next) {
    var service = this ;

    input.script.keyname = getScriptKeyname(input.script.name);

    var buf = fs.readFileSync(input.script.path);
    input.script.md5 = md5(buf);
    input.customer_name = input.customer.name;

    logger.log('saving file to storage');
    storageMedia.save(input,function(error,data){
      if(error) {
        logger.error('unable to storage files.');
        logger.error(error.message);
        logger.error(error);
        next(error);
      } else {
        logger.log('creating file entity');
        service.createEntity(input, function(error, entity){
          if(next) next(error, entity);
        });
      }
    });
  },
  createEntity : function(input,next) {
    next||(next=function(){});
    logger.log('creating script');
    var options = {
      customer    : input.customer,
      user        : input.user,
      description : input.description||input.script.name,
      filename    : input.script.name,
      keyname     : input.script.keyname,
      mimetype    : input.script.mimetype,
      extension   : input.script.extension,
      size        : input.script.size,
      md5         : input.script.md5,
      public      : input.public
    };

    Script.create(options,function(error,script){
      var customer_name = input.customer.name;
      if(error) return next(error,null);

      registerScriptCRUDOperation(customer_name,{
        'name':script.name,
        'customer_name':customer_name,
        'user_id':input.user.id,
        'user_email':input.user.email,
        'operation':'create'
      });
      return next(null,script);
    });
  },
  /**
   * Update a script.
   * @author Facundo
   * @param {Object} input
   */
  update: function(input, next)
  {
    next||(next=function(){});
    var script = input.script;
    var file = input.file;

    updateScriptFile(file,script,
      function(error, data){
        var updates = {
          'description': input.description,
          'keyname': data.keyname,
          'md5': data.md5,
          'name': file.name,
          'mimetype': file.mimetype,
          'size': file.size,
          'extension': file.extension,
          'public': input.public
        };

        logger.log('updating script data');
        script.update(updates, function(error){
          if(error) return next(error);
          registerScriptCRUDOperation(input.customer.name,{
            'name':script.name,
            'customer_name':input.customer.name,
            'user_id':input.user.id,
            'user_email':input.user.email,
            'operation':'update'
          });
          logger.log('script update completed');
          next(null,script);
        });
      }
    );
  },
  remove : function(input,next)
  {
    next||(next=function(){});

    var script = input.script;
    var query ;
    storageMedia.remove(script, function(error,data){
      logger.log('script removed from storage');

      var filter = {_id:script._id};
      Script.remove(filter,function(error){
        if(error) return next(error);

        registerScriptCRUDOperation(input.customer.name,{
          'name':script.name,
          'customer_name':input.customer.name,
          'user_id':input.user.id,
          'user_email':input.user.email,
          'operation':'delete'
        });

        next();
      });

      query = { 'script_id' : script._id };
      Task.find(query,function(error,tasks){
        tasks.forEach(function(task,idx){
          task.script_id = null;
          task.save();
        });
      });
    });
  },
  fetchBy : function(input,next)
  {
    var publishedScripts = [];
    Script.find(
      input,{},{ sort: { description:1 } }, function(error,scripts){
      var notFound = scripts === null || scripts instanceof Array && scripts.length === 0;
      if( notFound ) next([]);
    else
    {
      var asyncTasks = [];
      scripts.forEach(function(script){
        asyncTasks.push(function(callback){
          script.publish(function(error, data){
            publishedScripts.push(data);
            callback();
          });
        });
      });

      async.parallel(asyncTasks,function(){
        next(publishedScripts);
      });
    }
    });
  },
  getScriptStream: function(script,next) {
    storageMedia.getStream(
      script.keyname,
      script.customer_name,
      next
    );
  }
};

module.exports = Service ;
