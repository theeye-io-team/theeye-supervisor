"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;

function BaseSchema (specs) {

  // Schema constructor
  Schema.call(this, util._extend({
    task_id: { type: String },
    task: { type: Object }, // embedded
    host_id: { type: String },
    host: { type: ObjectId, ref:'Host' },
    user_id: { type: String },
    user: { type: ObjectId, ref:'User' },
    customer_id: { type: String },
    customer_name: { type: String },
    name: { type: String },
    notify: { type: Boolean },
    state: { type: String, default: 'unknown' },
    lifecycle: { type: String },
    result: { type: Object, default: {} },
    creation_date: { type: Date, default: Date.now },
    last_update: { type: Date, default: Date.now },
    event: { type: ObjectId, ref: 'Event' },
    event_id: { type: ObjectId },
    origin: { type: String }
  }, specs),{
    collection: 'jobs',
    discriminatorKey: '_type'
  });

  // Duplicate the ID field.
  this.virtual('id').get(function(){
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
    }
  }

  this.set('toJSON'  , def);
  this.set('toObject', def);

  return this;
}

util.inherits(BaseSchema, Schema);

module.exports = BaseSchema;
