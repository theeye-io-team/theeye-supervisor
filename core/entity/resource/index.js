require('mongoose-schema-extend');
var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var ObjectId = require('mongoose').Schema.Types.ObjectId;

var debug = require('debug')('eye:entity:resource');
var _ = require('lodash');

var INITIAL_STATE = 'normal' ;

/**
 * Extended Schema. Includes non template attributes
 */
var properties = {
  'host_id': { type:String },
  'hostname': { type:String },
  'fails_count': { type:Number, 'default':0 },
  'state': { type:String, 'default':INITIAL_STATE },
  'enable': { type:Boolean, 'default':true },
  'last_check': { type:Date, 'default':null },
  'creation_date': { type:Date, 'default':Date.now },
  'last_update': { type:Date, 'default':Date.now },
  'template': { type: ObjectId, ref: 'ResourceTemplate', 'default': null },
}; 

var ResourceSchema = BaseSchema.EntitySchema.extend(properties);

/**
 * Exports all my properties
 */
exports.properties = _.extend( {}, BaseSchema.properties, properties );

ResourceSchema.statics.INITIAL_STATE = INITIAL_STATE ;

ResourceSchema.methods.publish = function(next){
  var publishFn = BaseSchema.EntitySchema.methods.publish;
  var resource = this;
  next = next || function(){};

  debug('publishing resource');
  publishFn.call(this, function(error, data){
    if(error) return next(error);
    data.state = resource.state;
    data.enable = resource.enable;
    data.host_id = resource.host_id;
    data.hostname = resource.hostname;
    data.last_update = resource.last_update;

    next(null,data);
  });
}


/**
 *
 *
 */
ResourceSchema.statics.create = function(input, next){
  var data = { };
  next = next || function(){};
  for(var propname in BaseSchema.properties){
    if(input[propname]){
      data[propname] = input[propname];
    }
  }

  var entity = new Entity(data);
  entity.host_id = input.host_id;
  entity.hostname = input.hostname;
  entity.template = input.template || null;
  entity.save(function(err, instance){
    if(err) throw err;
    next(null, instance);
  });
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
