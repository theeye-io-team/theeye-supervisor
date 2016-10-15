"use strict";

require('mongoose-schema-extend');
var debug = require('debug')('entity:task');
var BaseSchema = require('../base-schema');
const Schema = require('mongoose').Schema;
var lodash = require('lodash');
const lifecicle = require('mongoose-lifecycle');

var EntitySchema = new BaseSchema({
  user_id : { type: String, 'default': null },
  customer_id : { type: String, ref: 'Customer' },
  public : { type: Boolean, 'default': false },
  tags: { type: Array, 'default':[] },
  type: { type: String, required: true },
  name: { type: String },
  description : { type: String },
  triggers: [{
    type: Schema.Types.ObjectId,
    ref: 'Event',
    'default':function(){return [];}
  }],
  grace_time: { type: Number, 'default': 0 }
},{ collection: 'tasks' });

exports.EntitySchema = EntitySchema;

/**
 *
 *
 *
 */
EntitySchema.statics.create = function(input,next)
{
  var instance = new this();
  instance.user_id = input.user_id||input.user._id;
  instance.customer_id = input.customer_id||input.customer._id;
  instance.script_id = input.script_id||input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.script_runas = input.script_runas;
  instance.name = input.name || null;
  instance.description = input.description || null;
  instance.tags = input.tags;
  instance.save(function(error,entity){
    next(null, entity);
  });
}

EntitySchema.statics.publishAll = function(entities, next){
  if(!entities||entities.length==0) return next([]);

  var published = [];
  var donePublish = lodash.after(entities.length, function(){
    next(null, published);
  });

  for(var i = 0; i<entities.length; i++){
    var entity = entities[i];
    entity.publish(function(data){
      published.push(data);
      donePublish();
    });
  }
}
