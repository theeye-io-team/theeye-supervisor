"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;
const async = require('async');
const randomSecret = require('../../lib/random-secret');

function BaseSchema (specs) {

  // Schema constructor
  Schema.call(this, util._extend({
    name: { type: String, 'default': '' },
    creation_date: { type: Date, 'default': Date.now },
    last_update: { type: Date, 'default': null },
    enable: { type: Boolean, 'default': true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    secret: { type: String, 'default': randomSecret }
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

  this.pre('save', function(next) {
    this.last_update = new Date();
    // do stuff
    next();
  });


  this.statics.fetch = function(query,done){
    // theres is a bug in mongoose with this schemas
    // populate within the find query does not work as expected
    this
    .find(query)
    .exec(function(err, events){
      async.each(
        events,
        function(e, callback){
          e.populate({
            path: 'emitter',
            populate: {
              path: 'host',
              model: 'Host'
            }
          }, callback)
        },
        function(err){
          done(err,events);
        }
      );
    });
  }

  return this;
}
util.inherits(BaseSchema, Schema);

module.exports = BaseSchema;
