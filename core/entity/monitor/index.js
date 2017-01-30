"use strict";

require('mongoose-schema-extend');
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var mongodb = require("../../lib/mongodb").db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var Resource = require('../resource').Entity;
var logger = require('../../lib/logger')('eye:entity:monitor');


/** Extended Schema. Includes non template attributes **/
var MonitorSchema = BaseSchema.EntitySchema.extend({
  host_id: { type: String, required: true },
  host: { type: ObjectId, ref: 'Host' },
  resource: { type: ObjectId, ref: 'Resource' },
  resource_id: { type: String },
  enable: { type: Boolean, 'default': true },
  creation_date: { type: Date, 'default': Date.now },
  last_update: { type: Date, 'default': Date.now },
  template: { type: ObjectId, ref: 'MonitorTemplate', 'default': null }
});

/**
 * extends publishing method to include Entity specific definitions
 * @author Facundo
 */
MonitorSchema.methods.publish = function(options, next)
{
  options = options || {};
  if (options.populate) {
    Entity.populate(this, {
      path:'resource'
    }, function(error, monitor){
      if(!monitor.resource) {
        logger.error('monitor.resource is null. could not populate');
        next(error);
      } else {
        next(error,monitor.toObject());
      }
    });
  } else {
    next(null, this.toObject());
  }
}

/**
 *
 * extract any non particular entity property.
 * @author Facundo
 *
 */
MonitorSchema.methods.toTemplate = function(doneFn)
{
  var entity = this;
  var values = this.toObject();
  var template = new Template(values);
  template.save(function(error){
    doneFn(error, template);
  });
}

MonitorSchema.methods.update = function(input,next) {
  var monitor = this;
  monitor.setUpdates(input, function(err,updates){
    Entity.update({ _id: monitor._id },updates,next);
  });
}

var Entity = mongodb.model('ResourceMonitor', MonitorSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
