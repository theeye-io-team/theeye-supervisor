"use strict";

require('mongoose-schema-extend');
var crypto = require('crypto');
var Schema = require('mongoose').Schema;
var mongodb = require('../../lib/mongodb').db;

var EntitySchema = Schema({
  name: { type: String, 'default': '' },
  creation_date: { type: Date, 'default': Date.now },
  last_update: { type: Date, 'default': null },
  enable: { type: Boolean, 'default': true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  secret: { type: String, 'default': function(){
    // one way hash
    return crypto.createHmac('sha256','THEEYE')
      .update( new Date().toISOString() )
      .digest('hex');
  }},
  emitter: { type: Object, 'default': () => { return {}; } }, /// << no related subdocument by default, is just an event
},{
  collection: 'events',
  discriminatorKey: '_type' 
});


// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
  return this._id.toHexString();
});

const specs = {
	getters: true,
	virtuals: true,
	transform: function (doc, ret, options) {
		// remove the _id of every document before returning the result
		ret.id = ret._id;
		delete ret._id;
		delete ret._type;
		delete ret.__v;
	}
}
EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);

exports.EntitySchema = EntitySchema;
