"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;
const crypto = require('crypto');
const lifecicle = require('mongoose-lifecycle');

function BaseSchema (specs) {
  // Schema constructor
  Schema.call(this, util._extend({
    name: { type: String, required: true },
    creation_date: { type: Date, 'default': Date.now },
    last_update: { type: Date, 'default': null },
    enable: { type: Boolean, 'default': true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  }, specs),{
    collection: 'workflow',
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

  this.plugin(lifecicle);

  return this;
}

util.inherits(BaseSchema, Schema);

module.exports = BaseSchema;
