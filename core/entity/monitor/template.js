const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const logger = require('../../lib/logger')('eye:entity:monitor:template')

const TemplateSchema = new BaseSchema({
  source_model_id: { type: ObjectId }, // if provided, is a reference to the source model. beware, won't be valid forever (eg. if the source model is deleted)
  hostgroup_id : { type: ObjectId, required: true },
  template_resource_id: { type: ObjectId },
  hostgroup: { type: ObjectId, ref: 'HostGroup' }, // belongs to
  template_resource: { type: ObjectId, ref: 'ResourceTemplate' }, // belongs to
  _type: { type: String, 'default': 'MonitorTemplate' }
}, { collection: 'monitor_templates' })

//TemplateSchema.methods.update = function(input, next) {
//  var monitor = this;
//  monitor.setUpdates(input, function(err,updates){
//    Entity.update(
//      { _id: monitor._id },
//      updates,
//      function(error, qr) {
//        if(error) debug(error);
//        if(next) next(error, qr);
//      }
//    );
//  });
//}

TemplateSchema.methods.publish = function (options, next) {
  var data = this.toObject()
  if (next) { next(null, data) }
  return data
}

TemplateSchema.methods.populate = function(next){
  return Entity.populate(this,'template_resource',next);
}

var Entity = mongodb.model('MonitorTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
