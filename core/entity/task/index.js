"use strict";

const ObjectId = require('mongoose').Schema.Types.ObjectId;
const lodash = require('lodash')
var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;

/**
 * Extended Schema. Includes non template attributes
 */
var TaskSchema = BaseSchema.extend({
  host_id: { type: String, 'default': null },
  host: { type: ObjectId, ref: 'Host', 'default': null },
  template: { type: ObjectId, ref: 'TaskTemplate', 'default': null },
  type: { type: String, 'default':'script' },
  script_arguments: { type: Array, 'default': [] },
  script_runas: { type: String, 'default':'' },
  script_id: { type: String, ref: 'Script' },
});

/**
 *
 * extract any non particular entity property.
 * @author Facundo
 *
 */
TaskSchema.methods.toTemplate = function(doneFn) {
  var values = this.toObject()
  var template = new Template(values)
  template.save(function(error){
    doneFn(error, template)
  });
}

TaskSchema.methods.templateProperties = function () {
  var values = BaseSchema.methods.templateProperties.apply(this,arguments)
  values.script_arguments = this.script_arguments 
  values.script_runas = this.script_runas
  values.script_id = this.script_id
  return values
}

/**
 *
 *
 *
 */
TaskSchema.statics.create = function(input,next) {
  var instance = new this();
  instance.host = (input.host||null);
  instance.host_id = (input.host?input.host._id:null);
  instance.customer_id = input.customer._id;
  instance.script_id = input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.script_runas = input.script_runas;
  instance.user_id = input.user._id;
  instance.public = (input.public||false);
  instance.name = (input.name||null);
  instance.template = (input.template_id||null);
  instance.description = (input.description||'');
  instance.tags = input.tags;
  instance.save(function(err,entity){
    next(err, entity);
  });
};

var Task = mongodb.model('Task', TaskSchema);
Task.ensureIndexes();

// called for both inserts and updates
Task.on('afterSave', function(model) {
  model.last_update = new Date();
  // do stuff
});
Task.on('afterUpdate',function(model){ });
Task.on('afterInsert',function(model){ });
Task.on('afterRemove',function(model){ });

exports.Entity = Task;
