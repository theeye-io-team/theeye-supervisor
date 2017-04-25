"use strict"

const debug = require('debug')('entity:task')
const Schema = require('mongoose').Schema
const lodash = require('lodash')
const async = require('async')
const randomSecret = require('../../lib/random-secret');
const FetchBy = require('../../lib/fetch-by');
require('mongoose-schema-extend')

var BaseSchema = require('../base-schema');

const properties = {
  user_id: { type: String, default: null },
  customer_id: { type: String, ref: 'Customer' },
  public: { type: Boolean, default: false },
  tags: { type: Array, default:[] },
  type: { type: String, required: true },
  name: { type: String },
  description : { type: String, default: '' },
  triggers: [{
    type: Schema.Types.ObjectId,
    ref: 'Event',
    default: function(){return [];}
  }],
  acl: [{ type: String }],
  // one way hash
  secret: { type:String, default:randomSecret },
  grace_time: { type:Number, default: 0 }
}

exports.properties = properties

var EntitySchema = new BaseSchema(properties,{
  collection: 'tasks',
  discriminatorKey: '_type'
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

EntitySchema.set('toJSON', def);
EntitySchema.set('toObject', def);

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

EntitySchema.statics.fetchBy = function (filter,next) {
  FetchBy.call(this,filter,next)
}

EntitySchema.methods.templateProperties = function () {
  const values = {}
  var key
  for (key in properties) {
    values[key] = this[key]
  }
  values.secret = undefined
  values.user_id = undefined
  return values
}

module.exports = EntitySchema;
