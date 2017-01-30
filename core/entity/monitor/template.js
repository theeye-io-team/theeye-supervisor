var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var logger = require('../../lib/logger')('eye:entity:monitor:template');

var TemplateSchema = BaseSchema.EntitySchema.extend({
  template_resource: {
    type: ObjectId,
    ref: 'ResourceTemplate'
  }
});

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
  return {
    'looptime': template.looptime,
    'config': template.config,
    'name': template.name,
    'type': template.type,
  }
}

TemplateSchema.methods.populate = function(nextFn){
  var monitor = this;
  return Entity.populate(monitor, 'template_resource', nextFn);
}

var Entity = mongodb.model('MonitorTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
