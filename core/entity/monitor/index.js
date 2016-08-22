"use strict";

require('mongoose-schema-extend');
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var mongodb = require("../../lib/mongodb").db;
var BaseSchema = require('./schema');
var Template = require('./template').Entity;
var Resource = require('../resource').Entity;
var logger = require('../../lib/logger')('eye:entity:monitor');
var _ = require('lodash');

var properties = {
  'host_id': { type: String, required: true },
  'resource': { type: ObjectId, ref: 'Resource' },
  'resource_id': { type: String },
  'enable': { type: Boolean, 'default': true },
  'creation_date': { type: Date, 'default': Date.now },
  'last_update': { type: Date, 'default': Date.now },
  'template': { type: ObjectId, ref: 'MonitorTemplate', 'default': null },
}

/** Extended Schema. Includes non template attributes **/
var MonitorSchema = BaseSchema.EntitySchema.extend(properties);

/** Exports all the properties **/
//exports.properties = _.extend({},BaseSchema.properties,properties);

/**
 * extends publishing method to include Entity specific definitions
 * @author Facundo
 */
MonitorSchema.methods.publish = function(options, next)
{
  options = options || {};
  if( options.populate ){
    Entity.populate(this, { path:'resource' }, function(error, monitor){
      if(!monitor.resource) {
        logger.error('monitor.resource is null. could not populate');
        next(error);
      } else {
        next(error,monitor.toObject());
      }
    });
  }
  else next(null, this.toObject());
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
  var values = {};

  for(var key in BaseSchema.properties){
    values[ key ] = entity[ key ];
  }
  
  var template = new Template(values);
  template.save(function(error){
    doneFn(error, template);
  });
}

/**
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {Object} options
 * @param {Function} doneFn
 *
 */
MonitorSchema.statics.FromTemplate = function(template, options, doneFn)
{
  doneFn=doneFn||()=>{};
  var host = options.host;
  Template.populate(template,{
    path: 'template_resource' 
  },function(err,monitorTemplate){
    var resourceTemplate = monitorTemplate.template_resource;
    var options = { 'host': host };
    Resource.FromTemplate(
      resourceTemplate,
      options,
      function(err,resource){
        if(err) {
          logger.error('Resorce creation error %s', err.message);
          return doneFn(err);
        }

        var input = {};
        input.host_id = options.host._id;
        input.resource = input.resource_id = resource._id;
        input.template = monitorTemplate._id || monitorTemplate.id;
        input.customer_name = options.host.customer_name;
        input._type = 'ResourceMonitor';
        // take shared properties from template
        for(var propname in BaseSchema.properties){
          if(template[propname]){
            input[propname] = template[propname];
          }
        }

        logger.log('creating monitor from template %j', input);
        var monitor = new Entity(input);
        monitor.save(function(err, instance){
          if(err) {
            logger.error('ERROR with %j', input);
            logger.error(err.message);
            return doneFn(err);
          }

          doneFn(null,{
            'monitor': instance,
            'resource': resource
          });
        });
      }
    );
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
