var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var logger = require('../../lib/logger')('eye:entity:resource:template');

var TemplateSchema = BaseSchema.EntitySchema.extend({
  'base_resource': { type: ObjectId, ref: 'Resource', 'default': null }
});

TemplateSchema.methods.updateInstancesOfGroupHosts = function(done)
{
  var template = this;
  logger.log('updating template resource "%s"(%s) instances',
    template.description,
    template._id
  )
  done()
}

TemplateSchema.methods.values = function(){
  var template = this
  return {
    'name': template.name,
    'type': template.type,
    'description': template.description,
    'attend_failure' : template.attend_failure,
    'failure_severity' : template.failure_severity,
  }
}

var Entity = mongodb.model('ResourceTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
