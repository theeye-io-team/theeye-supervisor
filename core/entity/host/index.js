"use strict";

var mongodb = require("../../lib/mongodb");
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const properties = {
  customer_name : { type : String },
  customer_id   : { type : String, index : true },
  ip            : { type : String },
  hostname      : { type : String, index : true, unique : true, required : true, dropDups: true },
  os_name       : { type : String },
  os_version    : { type : String },
  agent_version : { type : String },
  creation_date : { type : Date, 'default' : Date.now },
  last_update   : { type : Date, 'default' : null },
  enable        : { type : Boolean, 'default' : true }
};

var EntitySchema = Schema(properties);

EntitySchema.methods.publish = function(next)
{
  var data = this.toObject();
  if(next) next(data);
  return data;
}

EntitySchema.statics.create = function(data,customer,next) {
  var options = {
    "customer_name" : customer.name ,
    "customer_id"   : customer._id ,
    "creation_date" : new Date() ,
    "last_update"   : new Date() ,
    "hostname"      : data.hostname ,
    "ip"            : data.ip ,
    "os_name"       : data.os_name ,
    "os_version"    : data.os_version ,
    "agent_version" : data.agent_version ,
    "state"         : data.state
  };

  var host = new Entity(options);
  host.save(function(){
    next(null,host);
  });
};

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


var Entity = mongodb.db.model('Host', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
