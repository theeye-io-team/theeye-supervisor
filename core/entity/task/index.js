"use strict";

var ObjectId = require('mongoose').Schema.Types.ObjectId;
var lodash = require('lodash');
var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var logger = require('../../lib/logger')('eye:entity:task');
var Script = require('../script').Entity;
var Host = require('../host').Entity;

/** Entity properties **/
var properties = {
  host_id : { type: String, 'default': null },
  template : { type: ObjectId, ref: 'TaskTemplate', 'default': null },
  script_id : { type: String, ref: 'Script' },
  script_arguments : { type: Array, 'default': [] },
  script_runas : { type: String, 'default':'' },
  type: { type: String, 'default': 'script' }
};


/**
 * Extended Schema. Includes non template attributes
 */
var TaskSchema = BaseSchema.EntitySchema.extend(properties,{
  collection : 'tasks', discriminatorKey : '_type' 
});

exports.TaskSchema = TaskSchema;

/**
 *
 *
 */
TaskSchema.methods.publish = function(next) {
  var task = this;

  function preparePublish (options) {
    options||(options={});

    var data = task.toObject();

    if(options.host){
      data.host_id = options.host.id;
      data.hostname = options.host.hostname;
    }
    if(options.script){
      data.script_id = options.script.id;
      data.script_name = options.script.filename;
    }

    next(data);
  }

  var options = { host: null, script: null };

  var doneFn = lodash.after(2, () => preparePublish(options));

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
 * extract any non particular entity property.
 * @author Facundo
 *
 */
TaskSchema.methods.toTemplate = function(doneFn) {
  var entity = this;
  var values = {};

  for(var key in BaseSchema.properties){
    values[ key ] = entity[ key ];
  }

  var template = new Template(values);
  template.save(function(error){
    doneFn(error, template);
  });
};

/**
 *
 * @author Facundo
 * @param {Object} template, published task template - flattened object
 *
 */
TaskSchema.statics.FromTemplate = function(
  template,
  options,
  doneFn
) {
  logger.log('creating task from template %j', template);

  var instance = new this(template);
  instance.host_id = options.host?options.host._id:null;
  instance.template = template._id||template.id;
  instance.id = null;
  instance.user_id = null;
  instance._id = null;
  instance._type = 'Task';
  instance.save(function(err,task){
    if(err) logger.error(err);
    doneFn(err,task);
  });
};

/**
 *
 *
 *
 */
TaskSchema.statics.create = function(input,next)
{
  var instance = new this();
  instance.host_id          = input.host ? input.host._id : null ;
  instance.customer_id      = input.customer._id;
  instance.script_id        = input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.script_runas     = input.script_runas;
  instance.user_id          = input.user._id;
  instance.name             = input.name || null;
  instance.public           = input.public || false;
  instance.template         = input.template_id || null;
  instance.description      = input.description || null;
  instance.tags             = input.tags;
  instance.save(function(err,entity){
    next(err, entity);
  });
};

var Entity = mongodb.model('Task', TaskSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
