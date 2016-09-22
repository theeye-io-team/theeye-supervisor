"use strict";

var crypto = require('crypto');
var util = require('util');
var Schema = require('mongoose').Schema;

function BaseSchema (specs) {

  // Schema constructor
  Schema.call(this, util._extend({
    name: { type: String, 'default': '' },
    creation_date: { type: Date, 'default': Date.now },
    last_update: { type: Date, 'default': null },
    enable: { type: Boolean, 'default': true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    secret: { type: String, 'default': function(){
      // one way hash
      return crypto.createHmac('sha256','THEEYE' + Math.random())
      .update( new Date().toISOString() )
      .digest('hex');
    }}
  }, specs),{
    collection: 'events',
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
