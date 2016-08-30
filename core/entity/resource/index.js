"use strict";

require('mongoose-schema-extend');
var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var ObjectId = require('mongoose').Schema.Types.ObjectId;

var debug = require('debug')('eye:entity:resource');
var _ = require('lodash');

var INITIAL_STATE = 'normal' ;

/**
 * Exports all my properties
 */
var properties = {
  'host_id': { type:String },
  'hostname': { type:String },
  'fails_count': { type:Number, 'default':0 },
  'state': { type:String, 'default':INITIAL_STATE },
  'enable': { type:Boolean, 'default':true },
  'creation_date': { type:Date, 'default':Date.now },
  'template': { type: ObjectId, ref: 'ResourceTemplate', 'default': null },
  'last_check': { type:Date, 'default':null },
  'last_update': { type:Date, 'default':Date.now },
  'last_event':{ type: Object, 'default':{} }
}

/**
 * Extended Schema. Includes non template attributes
 */
var ResourceSchema = BaseSchema.EntitySchema.extend(properties);

//exports.properties = _.extend({}, BaseSchema.properties, properties);

ResourceSchema.statics.INITIAL_STATE = INITIAL_STATE ;

/**
 *
 *
 */
ResourceSchema.statics.create = function(input, next){
  var data = {};
  next||(next=function(){});

  //for(var propname in properties){
  //  if(input[propname]){
  //    data[propname] = input[propname];
  //  }
  //}
  //var entity = new Entity(data);
  var entity = new Entity(input);
  entity.host_id = input.host_id;
  entity.hostname = input.hostname;
  entity.template = input.template||null;
  entity.save(function(err, instance){
    if(err) throw err;
    next(null, instance);
  });
}

/**
 *
 * @author Facundo
 *
 */
ResourceSchema.methods.patch = function(input, next){
  next||(next=function(){});
  //var updates = {};
  //for(let propName in properties){
  //  if(input.hasOwnProperty(propName) && input[propName]){
  //    updates[propName] = input[propName];
  //  }
  //}
  //if(Object.keys(updates).length>0){
  //  this.update(updates, function(error,result){
    this.update(input, function(error,result){
      next(error,result);
    });
  //} else next();
}

/**
 *
 * extract any non particular entity property.
 * @author Facundo
 *
 */
ResourceSchema.methods.toTemplate = function(doneFn) {
  var entity = this;
  var values = {};

  for(var key in BaseSchema.properties){
    values[ key ] = entity[ key ];
  }

  values.base_resource = entity;
  
  var template = new Template(values);
  template.save(function(error){
    doneFn(error, template);
  });
}

ResourceSchema.statics.FromTemplate = function(
  template, 
  options, 
  doneFn
) {
  var data = {
    'host_id': options.host._id,
    'hostname': options.host.hostname,
    'template': template._id
  };
  var input = _.extend( data, template.toObject() );
  input.description = input.description;
  input.name = input.name;
  delete input._id;
  debug('creating resource from template %j', input);

  var model = new this(input);
  model.last_update = new Date();
  model._type = 'Resource';
  model.save(function(err){
    if(err){
      debug('ERROR with %j',input);
      debug(err.message);
    }
    doneFn(err,model);
  });
}

var Entity = mongodb.model('Resource', ResourceSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
