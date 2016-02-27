var mongodb = require("../lib/mongodb");
var Schema = require('mongoose').Schema;
var ObjectID = require('mongodb').ObjectID;

var properties = {
  customer_name : { type : String, index : true },
  hostname      : { type : String, index : true, unique : true, required : true, dropDups: true },
  customer_id   : { type : String },
  ip            : { type : String },
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
  var host = this;
  var pub = {
    id: host._id,
    last_update: host.last_update,
    customer_id: host.customer_id,
    hostname: host.hostname,
    os_name: host.os_name,
    os_version: host.os_version,
    agent_version: host.agent_version,
    enable: host.enable
  };
  if(next) next(pub);
  return pub;
}

EntitySchema.statics.create = function(data,customer,next)
{
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

var Entity = mongodb.db.model('Host', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
