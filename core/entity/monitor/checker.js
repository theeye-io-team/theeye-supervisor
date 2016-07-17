var Schema = require('mongoose').Schema;
var mongodb = require("../../lib/mongodb");
var os = require('os');

var debug = require('debug')('eye:entity:monitor:checker');

var properties = {
  running: { type:Boolean, 'default':false },
  last_worker: { type:String, 'default':null },
  start_time: { type:Number, 'default':null },
  end_time: { type:Number, 'default':null },
  last_update: { type:Date, 'default':new Date() },
  enabled: { type:Boolean, 'default':true },
};

/** Schema **/
var EntitySchema = Schema(properties,{ discriminatorKey : '_type' });
exports.EntitySchema = EntitySchema;

EntitySchema.methods.inProgress = function(){
  return this.running ;
}

EntitySchema.methods.take = function(done)
{
  done||(done=function(){});
  if( this.inProgress() ){
    throw new Error('checker in progress. cant be taken!');
  }

  this.running = true;
  this.start_time = Date.now();
  this.end_time = 0;
  this.last_update = Date.now();
  this.last_worker = os.hostname();
  this.save(function(){
    done();
  });
}

EntitySchema.methods.release = function(done){
  done||(done=function(){});
  if( ! this.inProgress() ){
    throw new Error('checker is not in progress. nothing to do.');
  }

  this.running = false;
  this.end_time = Date.now();
  this.last_update = Date.now();
  this.last_worker = os.hostname();
  this.save(function(){
    done();
  });
}

var Entity = mongodb.db.model('MonitorChecker', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
