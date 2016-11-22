"use strict";

require('mongoose-schema-extend');
const debug = require('debug')('entity:task');
const Schema = require('mongoose').Schema;
const lodash = require('lodash');
const lifecicle = require('mongoose-lifecycle');
const randomSecret = require('../../lib/random-secret');

var BaseSchema = require('../base-schema');

var EntitySchema = new BaseSchema({
  user_id: { type: String, default: null },
  customer_id: { type: String, ref: 'Customer' },
  public: { type: Boolean, default: false },
  tags: { type: Array, default:[] },
  type: { type: String, required: true },
  name: { type: String },
  description : { type: String },
  triggers: [{
    type: Schema.Types.ObjectId,
    ref: 'Event',
    default:function(){return [];}
  }],
  acl: [{ type: String }],
  // one way hash
  secret: { type:String, default:randomSecret },
  grace_time: { type:Number, default: 0 }
},{
  collection: 'tasks',
  discriminatorKey: '_type'
});

// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
  return this._id.toHexString();
});

const def = {
  getters: true,
  virtuals: true,
  transform: function (doc, ret, options) {
    // remove the _id of every document before returning the result
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.secret;
  }
}

EntitySchema.set('toJSON'  , def);
EntitySchema.set('toObject', def);

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
  var donePublish = lodash.after(entities.length, () => next(null, published));

  for (var i = 0; i<entities.length; i++) {
    var entity = entities[i];
    entity.publish(function(data){
      published.push(data);
      donePublish();
    });
  }
}

exports.EntitySchema = EntitySchema;
