"use strict";

var debug = require('debug')('eye:supervisor:entity:task');
var Schema = require('mongoose').Schema;
var _ = require('lodash');

var Host = require('../host').Entity;
var Resource = require('../resource').Entity;
var Script = require('../script').Entity;


/** Entity properties **/
var properties = exports.properties = {
  'name' : { type: String },
  'description' : { type: String },
  'script_id' : { type: String },
  'script_arguments' : { type: Array, 'default': [] },
  'user_id' : { type: String, 'default': null },
  'customer_id' : { type: String, 'default': null },
};

/** Schema **/
var EntitySchema = Schema(properties,{ discriminatorKey : '_type' });
exports.EntitySchema = EntitySchema;

/**
 *
 *
 */
EntitySchema.methods.publish = function(next)
{
  var task = this;

  function preparePublish(options)
  {
    options = options || {};

    var data = {
      'id': task._id,
      'name': task.name,
      'description': task.description,
      'script_arguments': task.script_arguments,
      'public': task.public,
      'customer_id': task.customer_id,
    };

    if(options.host){
      data.host_id = options.host.id;
      data.hostname = options.host.hostname;
    }
    if(options.script){
      data.script_id = options.script.id;
      data.script_name = options.script.description;
    }
    if(options.resource){
      data.resource_id = options.resource.id;
      data.resource_name = options.resource.name;
      data.resource_type = options.resource.type;
    }

    debug('publish ready');
    next(data);
  }

  var options = {
    host : null, 
    script : null, 
    resource : null 
  };

  var doneFn = _.after(3, function(){
    preparePublish(options);
  });

  debug('publishing');
  if( ! task.resource_id ) doneFn();
  else Resource.findById(task.resource_id, function(err,resource){
    if( ! err || resource != null ) options.resource = resource;
    doneFn();
  });

  if( ! task.host_id ) doneFn();
  else Host.findById(task.host_id, function(err,host){
    if( ! err || host != null ) options.host = host;
    doneFn();
  });

  if( ! task.script_id ) doneFn();
  else Script.findById(task.script_id, function(err,script){
    if( ! err || script != null ) options.script = script;
    doneFn();
  });
}

/**
 *
 *
 *
 */
EntitySchema.methods.update = function(input,next)
{
  var task = this ;
  for(var key in input){
    if( task.toObject().hasOwnProperty(key) ) {
      task[key] = input[key];
    }
  };

  debug('saving task %j', task);
  task.save(function(error){
    if(error) return next(error);
    next(null, task);
  });
}

/**
 *
 *
 *
 */
EntitySchema.statics.create = function(input,next)
{
  var instance = new this();
  instance.user_id          = input.user._id;
  instance.customer_id      = input.customer._id;
  instance.script_id        = input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.name             = input.name || null;
  instance.description      = input.description || null;
  instance.save(function(error,entity){
    next(null, entity);
  });
}

/**
 *
 *
 */
EntitySchema.statics.publishAll = function(entities, next){
  if(!entities || entities.length == 0) return next([]);

  var published = [];
  var donePublish = _.after(entities.length, function(){
    next(null, published);
  });

  for(var i = 0; i<entities.length; i++){
    var entity = entities[i];
    entity.publish(function(data){
      published.push(data);
      donePublish();
    });
  }
}
