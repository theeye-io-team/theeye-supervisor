
const md5 = require('md5');
const fs = require('fs');
const extend = require('util')._extend;
const Script = require("../entity/file").Script;
const Task = require("../entity/task").Entity;
const logger = require('../lib/logger')('service:script');
const storage = require('../lib/storage').get();

/**
 *
 * @author Facundo
 * @param
 *
 */
//function updateScriptFile (file, script, doneFn) {
//  if (file) {
//    if (file.name != script.filename) {
//      logger.log('new file uploaded. removing old one');
//      file.keyname = getScriptKeyname(file.name);
//      storage.remove(script);
//    } else {
//      logger.log('replace old uploaded file');
//      file.keyname = script.keyname;
//    }
//
//    var buf = fs.readFileSync(file.path);
//    file.md5 = md5(buf) ;
//
//    logger.log('saving file to media storage');
//    storage.save({
//      'customer_name': script.customer_name,
//      'script': file
//    },function(error,data){
//      if(error) {
//        logger.error('cannot save script into storage');
//        logger.error(error);
//        return doneFn(error);
//      }
//      return doneFn(null, file);
//    });
//  }
//  else doneFn();
//}

//function getScriptKeyname (filename) {
//  return filename + '[ts:' + Date.now() + ']' ;
//}

// @TODO verify this code. is no longer used. there are no references to this

module.exports = {
  /**
   * Update a script.
   * @author Facundo
   * @param {Object} input
   */
  //update (input, next) {
  //  next||(next=function(){});
  //  var script = input.script
  //  var file = input.file

  //  updateScriptFile(file, script, (error, data) => {
  //    var updates = extend(input,{
  //      keyname: data.keyname,
  //      md5: data.md5,
  //      filename: file.name,
  //      mimetype: file.mimetype,
  //      size: file.size,
  //      extension: file.extension,
  //      last_update: new Date()
  //    })

  //    logger.log('updating script')
  //    script.update(updates,error => {
  //      if(error) return next(error)
  //      logger.log('script updated')
  //      next(null,script)
  //    })
  //  })
  //},
  remove : function(input,next) {
    console.error('service.script remove DEPRECATED')
    console.error('service.script remove DEPRECATED')
    console.error('service.script remove DEPRECATED')
    console.error('service.script remove DEPRECATED')
    next||(next=function(){});

    var script = input.script;
    var query ;
    storage.remove(script, function(error,data){
      logger.log('script removed from storage');

      var filter = {_id:script._id};
      Script.remove(filter,function(error){
        if(error) return next(error);
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
  getScriptStream: function(script,next) {
    console.error('service.script getScriptStream DEPRECATED')
    console.error('service.script getScriptStream DEPRECATED')
    console.error('service.script getScriptStream DEPRECATED')
    console.error('service.script getScriptStream DEPRECATED')
    storage.getStream(
      script.keyname,
      script.customer_name,
      next
    );
  }
};
