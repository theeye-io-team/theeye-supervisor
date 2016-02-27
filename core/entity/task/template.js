var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');

var TemplateSchema = BaseSchema.EntitySchema.extend({ });

TemplateSchema.methods.values = function(){
  var template = this
  return {
		'name': template.name,
		'description': template.description,
		'script_id': template.script_id,
		'script_arguments': template.script_arguments,
  }
}

var Entity = mongodb.model('TaskTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
