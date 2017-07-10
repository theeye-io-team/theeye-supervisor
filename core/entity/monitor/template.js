'use strict'

const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const logger = require('../../lib/logger')('eye:entity:monitor:template')

const TemplateSchema = BaseSchema.EntitySchema.extend({
  source_model_id: { type: ObjectId }, // if provided, is a reference to the source model. beware, won't be valid forever (eg. if the source model is deleted)
  hostgroup_id : { type: ObjectId, required: true },
  template_resource_id: { type: ObjectId },
  // RELATIONS
  hostgroup: { type: ObjectId, ref: 'HostGroup' }, // belongs to
  template_resource: { type: ObjectId, ref: 'ResourceTemplate' } // belongs to
},{
  // store templates in different collection
  collection: 'monitor_templates',
  discriminatorKey: '_type'
})

TemplateSchema.methods.update = function(input, next) {
  var monitor = this;
  monitor.setUpdates(input, function(err,updates){
    Entity.update(
      { _id: monitor._id },
      updates,
      function(error, qr) {
        if(error) debug(error);
        if(next) next(error, qr);
      }
    );
  });
}

var publishFn = BaseSchema.EntitySchema.methods.publish;
TemplateSchema.methods.publish = function(options, next){
  var template = this;
  publishFn.call(this, options, function(err, data){
    if(err) next(err);
    data.template_resource = template.template_resource;
    next(null, data)
  })
}

TemplateSchema.methods.values = function(){
  var template = this
  throw new Error('WTF!')
  return {
    looptime: template.looptime,
    config: template.config,
    name: template.name,
    type: template.type,
  }
}

TemplateSchema.methods.populate = function(next){
  return Entity.populate(this,'template_resource',next);
}

var Entity = mongodb.model('MonitorTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
