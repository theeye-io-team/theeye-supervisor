"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;
const FetchBy = require('../../lib/fetch-by');
const baseProperties = require('./schema-properties.js')

function BaseSchema (props) {

  // Schema constructor
  Schema.call(this, Object.assign({}, baseProperties, props), {
    collection: 'jobs',
    discriminatorKey: '_type'
  });

  this.statics.fetchBy = function (filter, next) {
    FetchBy.call(this,filter,next)
  }

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

  /*
   * @return {Boolean}
   */
  this.methods.isIntegrationJob = function () {
    return ( /IntegrationJob/.test(this._type) === true )
  }

  return this;
}

util.inherits(BaseSchema, Schema);

module.exports = BaseSchema;
