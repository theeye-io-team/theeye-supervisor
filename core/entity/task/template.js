'use strict';

var mongodb = require('../../lib/mongodb').db;
var Script = require('../file').Script;
var BaseSchema = require('./schema');

var TemplateSchema = BaseSchema.extend({
  script_id : { type: String, ref: 'Script' },
  script_arguments : { type: Array, 'default': [] },
  script_runas : { type: String, 'default':'' },
  type: { type: String, 'default': 'script' }
},{ collection: 'tasktemplates' }); // store templates in different collection

/**
 *
 *
 *
 */
TemplateSchema.statics.create = function (input,next) {
  var instance = new this();
  instance.user_id = input.user_id||input.user._id;
  instance.customer_id = input.customer_id||input.customer._id;
  instance.script_id = input.script_id||input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.script_runas = input.script_runas;
  instance.name = input.name;
  instance.description = (input.description||'');
  instance.tags = input.tags;
  instance.save(function(error,entity){
    next(null, entity);
  });
}

TemplateSchema.methods.values = function () {
  var template = this
  return {
		name: template.name,
		description: template.description,
		script_id: template.script_id,
		script_arguments: template.script_arguments,
  }
}

TemplateSchema.methods.publish = function (done) {
  var data = this.toObject();
  if (!this.script_id) return done();
  Script.findById(this.script_id, function(err,script){
    if (err||!script) return done(data);
    data.script_name = script.filename;
    done(data);
  });
}

var updateFn = TemplateSchema.methods.update;
TemplateSchema.methods.update = function (input) {
  input._type = 'TaskTemplate';
  updateFn.apply(this,arguments);
}

var Entity = mongodb.model('TaskTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
