var Script = require(process.env.BASE_PATH + "/entity/script").Entity;
var Task = require(process.env.BASE_PATH + "/entity/task").Entity;
var logger = require('../lib/logger')('eye:supervisor:service:script');
var S3Storage = require('../lib/store').S3;
var LocalStorage = require('../lib/store').Local;
var async = require('async');
var md5 = require('md5');
var fs = require('fs');
var config = require('config');

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

var Service = {
  handleUploadedScript : function(input,next)
  {
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
  /**
   * Update a script.
   * @author Facundo
   * @param {Object} input
   */
  handleUpdateUploadedScript : function(input, next)
  {
    var script = input.script;
    var file = input.file;

    updateScriptFile(
      file, 
      script, 
      function(error, data){
        var updates = {
          'description': input.description,
          'keyname': data.keyname, // name.extension + [ts:########]
          'md5': data.md5,
          'name': file.name,
          'mimetype': file.mimetype,
          'size': file.size,
          'extension': file.extension,
        };
        logger.log('updating script data');
        script.update(updates, function(error){
          logger.log('script update completed');
          if(next) next(error, script);
        });
      });
  },
  remove : function(script,next)
  {
    storageMedia.remove(script,
      function(error,data)
      {
        Script.remove({
          _id : script._id
        },function(error){
          next(error,null);
        });

        Task.find({
          script_id : script._id
        },function(error,tasks){
          tasks.forEach(function(task,idx){
            task.script_id = null;
            task.save();
          });
        });
      }
    );
  },
  createEntity : function(input,next)
  {
    logger.log('creating script');
    var options = {
      customer    : input.customer,
      user        : input.user,
      description : input.description || input.script.name,
      filename    : input.script.name,
      keyname     : input.script.keyname,
      mimetype    : input.script.mimetype,
      extension   : input.script.extension,
      size        : input.script.size,
      md5         : input.script.md5
    };

    Script.create(options,function(error,script){
      if(next) next(error, script);
    });
  },
  fetchBy : function(input,next)
  {
    var publishedScripts = [];
    Script.find(
      input,{},{ sort: { description:1 } }, function(error,scripts){
      var notFound = scripts == null || scripts instanceof Array && scripts.length === 0;
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
  getScriptStream : function(script,next)
  {
    storageMedia.getStream(script.keyname,script.customer_name, next);
  }
};

module.exports = Service ;
