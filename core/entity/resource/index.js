'use strict';

require('mongoose-schema-extend');
const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');
const Template = require('./template').Entity;
const ObjectId = require('mongoose').Schema.Types.ObjectId;
const debug = require('debug')('eye:entity:resource');
const extend = require('lodash/assign');
const INITIAL_STATE = 'normal'

/**
 * Extended Schema. Includes non template attributes
 */
var ResourceSchema = BaseSchema.EntitySchema.extend({
  //host_id: { type: String, required: true },
  host_id: { type: String },
  monitor_id: { type: ObjectId },
  template_id: { type: ObjectId },
  hostname: { type: String },
  fails_count: { type: Number, default: 0 },
  state: { type: String, default: INITIAL_STATE },
  enable: { type: Boolean, default: true },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  last_event: { type: Object, default: () => { return {} } },
  last_check: { type: Date },
  // relations
  monitor: { type: ObjectId, ref: 'ResourceMonitor' }, // has one
  template: { type: ObjectId, ref: 'ResourceTemplate' }, // has one
  host: { type: ObjectId, ref: 'Host' }, // belongs to
})

ResourceSchema.statics.INITIAL_STATE = INITIAL_STATE

ResourceSchema.statics.create = function(input, next){
  var data = {};
  next||(next=function(){});

  var entity = new Entity(input);
  entity.host_id = input.host_id;
  entity.hostname = input.hostname;
  entity.template = input.template || null;
  entity.save(function(err, instance){
    if (err) return next (err)
    next(null, instance)
  })
}

/**
 *
 * @author Facundo
 *
 */
ResourceSchema.methods.patch = function(input, next){
  next||(next=function(){});
  this.update(input, function(error,result){
    next(error,result);
  });
}

/**
 *
 * extract any non particular entity property.
 * @author Facundo
 *
 */
ResourceSchema.methods.toTemplate = function(doneFn) {
  const values = this.templateProperties()
  const template = new Template(values)
  template.save(function(error){
    doneFn(error, template)
  });
}

ResourceSchema.methods.templateProperties = function() {
  const values = {}
  var key
  for (key in BaseSchema.properties) {
    values[key] = this[key]
  }
  return values
}

/**
 *
 * @param {Object} template
 * @param {Object} options
 * @param {Function} done
 * @return undefined
 *
 */
ResourceSchema.statics.createFromTemplate = function(template, options, done) {
  throw new Error('nothing to do here anymore!')
}

ResourceSchema.methods.populate = function(options,next){
  return next(null,this)
  //return Entity.populate(this,[
  //  { path: '' },
  //],next)
}

var Entity = mongodb.model('Resource', ResourceSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
