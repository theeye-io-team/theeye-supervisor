require('mongoose-schema-extend');
var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var logger = require('../../lib/logger')('eye:entity:task');
var _ = require('lodash');

/** Entity properties **/
var properties = exports.properties = {
  'host_id' : { type: String, 'default': null },
  'resource_id' : { type: String, 'default': null },
  'creation_date' : { type: Date, 'default': Date.now() },
  'last_update' : { type: Date, 'default': Date.now() },
  'template' : { type: ObjectId, ref: 'TaskTemplate', 'default': null },
  'public' : { type: Boolean, 'default': false } ,
};

/**
 * Extended Schema. Includes non template attributes
 */
var TaskSchema = BaseSchema.EntitySchema.extend(properties);

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
}

/**
 *
 * @author Facundo
 * @param {Object} template, published task template - flattened object
 *
 */
TaskSchema.statics.FromTemplate = function(template, options, doneFn) {
  logger.log('creating task from template %j', template);
  var instance = new this( template );
  instance.resource_id = options.resource ? options.resource._id : null;
  instance.host_id = options.host._id;
  instance.template = template._id || template.id;
  instance.save(doneFn);
}

/**
 *
 *
 *
 */
TaskSchema.statics.create = function(input,next)
{
  var instance = new this();
  instance.resource_id      = input.resource ? input.resource._id : null;
  instance.host_id          = input.host ? input.host._id : null ;
  instance.customer_id      = input.customer._id;
  instance.script_id        = input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.user_id          = input.user._id;
  instance.name             = input.name || null;
  instance.public           = input.public || false;
  instance.description      = input.description || null;
  instance.save(function(error,entity){
    next(null, entity);
  });
}

var Entity = mongodb.model('Task', TaskSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
