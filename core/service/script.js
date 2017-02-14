'use strict';

var async = require('async');
var md5 = require('md5');
var fs = require('fs');
var config = require('config');
var path = require('path');
var extend = require('util')._extend;
var Script = require("../entity/file").Script;
var Task = require("../entity/task").Entity;
var logger = require('../lib/logger')('service:script');
var elastic = require('../lib/elastic');
var storage = require('../lib/storage').get();

/**
 *
 * @author Facundo
 * @param
 *
 */
function updateScriptFile (file, script, doneFn) {
  if (file) {
    if (file.name != script.filename) {
      logger.log('new file uploaded. removing old one');
      file.keyname = getScriptKeyname(file.name);
      storage.remove(script);
    } else {
      logger.log('replace old uploaded file');
      file.keyname = script.keyname;
    }

    var buf = fs.readFileSync(file.path);
    file.md5 = md5(buf) ;

    logger.log('saving file to media storage');
    storage.save({
      'customer_name': script.customer_name,
      'script': file
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

function getScriptKeyname (filename) {
  return filename + '[ts:' + Date.now() + ']' ;
}

function registerScriptCRUDOperation(customer,data) {
  var key = config.elasticsearch.keys.script.crud;
  elastic.submit(customer,key,data);
}


module.exports = {
  create: function (input,next) {
    var self = this;
    var buf = fs.readFileSync(input.script.path);

    input.script.keyname = getScriptKeyname(input.script.name);
    input.script.md5 = md5(buf);
    input.customer_name = input.customer.name;

    logger.log('saving file to storage');
    storage.save(input,function(error,data){
      if(error) {
        logger.error('unable to storage files.');
        logger.error(error.message);
        logger.error(error);
        next(error);
      } else {
        logger.log('creating file entity');
        self.createEntity(input, function(error, entity){
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
      description : (input.description||''),
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

    updateScriptFile(file, script, (error, data) => {
      var updates = extend(input,{
        'keyname': data.keyname,
        'md5': data.md5,
        'filename': file.name,
        'mimetype': file.mimetype,
        'size': file.size,
        'extension': file.extension,
        'last_update': new Date()
      });

      logger.log('updating script');
      script.update(updates,error => {
        if(error) return next(error);
        registerScriptCRUDOperation(
          input.customer.name, {
            'name':script.name,
            'customer_name':input.customer.name,
            'user_id':input.user.id,
            'user_email':input.user.email,
            'operation':'update'
          }
        );
        logger.log('script updated');
        next(null,script);
      });
    });
  },
  remove : function(input,next)
  {
    next||(next=function(){});

    var script = input.script;
    var query ;
    storage.remove(script, function(error,data){
      logger.log('script removed from storage');

      var filter = {_id:script._id};
      Script.remove(filter,function(error){
        if(error) return next(error);

        registerScriptCRUDOperation(input.customer.name,{
          name: script.name,
          customer_name: input.customer.name,
          user_id: input.user.id,
          user_email: input.user.email,
          operation: 'delete'
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
  getScriptStream: function(script,next) {
    storage.getStream(
      script.keyname,
      script.customer_name,
      next
    );
  }
};
