"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;

function BaseSchema (specs) {

  // Schema constructor
  Schema.call(this, util._extend({
    task_id: { type: String, 'default':null },
    task: { type: Object, 'default':null }, // embedded
    host_id: { type: String, 'default':null },
    host: { type: Schema.Types.ObjectId, ref:'Host', 'default':null },
    user_id: { type: String, 'default':null },
    user: { type: Schema.Types.ObjectId, ref:'User', 'default':null },
    customer_id: { type:String, 'default':null },
    customer_name: { type : String, 'default':null },
    name: { type: String, 'default':null },
    notify: { type: Boolean, 'default':null },
    state: { type: String, 'default':null },
    result: { type: Object, 'default': {} },
    creation_date: { type: Date, 'default': Date.now },
    last_update: { type: Date, 'default': Date.now },
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
