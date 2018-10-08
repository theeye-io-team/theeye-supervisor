'use strict';

const util = require('util')
const Schema = require('mongoose').Schema
const async = require('async')
const properties = require('./base-properties')

function BaseSchema (specs) {

  // Schema constructor
  Schema.call(this, Object.assign({}, properties, specs),{
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

  this.set('toJSON', def);
  this.set('toObject', def)

  this.pre('save', function(next) {
    this.last_update = new Date()
    // do stuff
    next()
  });

  this.statics.fetch = function (query,done) {
    this
      .find(query)
      .select('_id emitter name _type emitter_id')
      .populate({
        path: 'emitter',
        select: '_id name _type type host host_id workflow_id',
        populate: {
          path: 'host',
          select: 'hostname _id'
        }
      }).exec((err, events) => {
        return done(err, events)
      })
  }

  return this
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
