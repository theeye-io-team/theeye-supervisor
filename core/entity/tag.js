"use strict";

var mongodb = require("../lib/mongodb");
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const properties = {
  name: { type: String },
  creation_date: { type: Date, 'default': new Date() },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
};

var EntitySchema = Schema(properties);

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

EntitySchema.statics.create = function(tags,customer,next){
  next||(next=function(){});
  if(!tags||tags.length===0) return next();
  var data = tags.map(tag => {
    return {
      _id: mongoose.Types.ObjectId(),
      name: tag,
      customer: mongoose.Types.ObjectId( customer._id )
    }
  });
  Entity.collection.insert(data,(error,instances)=>{
    next(error,instances);
  });
}

EntitySchema.index({ name: 1, customer: 1 },{ unique: true });

var Entity = mongodb.db.model('Tag', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
