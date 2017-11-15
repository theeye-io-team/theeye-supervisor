'use strict';

const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const Template = require('./template').Entity
const TASK = require('../../constants/task')
const ScraperTask = require('./scraper').Entity

/**
 * Extended Schema. Includes non template attributes
 */
const TaskSchema = BaseSchema.extend({
  template_id: { type: ObjectId },
  host_id: { type: String },
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: { type: Array },
  type: { type: String, default: 'script' },
  // relations
  host: { type: ObjectId, ref: 'Host' },
  script: { type: ObjectId, ref: 'Script' },
  template: { type: ObjectId, ref: 'TaskTemplate' },
})

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
  })
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
  var instance = new this()
  const host_id = input.host ? input.host._id : null

  instance.host = host_id
  instance.host_id = host_id
  instance.customer = input.customer._id
  instance.customer_id = input.customer._id
  instance.script_id = input.script._id
  instance.script_arguments = input.script_arguments
  instance.script_runas = input.script_runas
  instance.user_id = input.user._id
  instance.tags = input.tags
  instance.public = input.public || false
  instance.name = input.name || null
  instance.template = input.template_id || null
  instance.template_id = input.template_id || null
  instance.description = input.description || ''
  instance.save(next)
}

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
exports.ScriptTask = Task
exports.ScraperTask = ScraperTask

exports.Factory = {
  create (input) {
    if (input.type == TASK.TYPE_SCRAPER) {
      return new ScraperTask(input)
    }
    if (input.type == TASK.TYPE_SCRIPT) {
      return new Task(input)
    }
    throw new Error('invalid error type ' + input.type)
  }
}
