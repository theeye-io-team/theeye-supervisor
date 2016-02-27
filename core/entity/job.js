var mongodb = require('../lib/mongodb');
var Schema = require('mongoose').Schema;
var Script = require('./script').Entity;

var EntitySchema = Schema({
  task_id : { type : String },
  host_id : { type : String },
  script_id : { type : String },
  script_arguments : { type : Array, default: [] },
  customer_id : { type : String },
  customer_name : { type : String },
  user_id : { type : String },
  name : { type : String },
  notify : { type : Boolean },
  state : { type : String },
  creation_date : { type : Date, default  : Date.now },
  last_update : { type : Date, default  : Date.now },
  result : { type : Object, default : {} }
});

var debug = require('../lib/logger')('eye:supervisor:entity:job');

EntitySchema.methods.publish = function(next){
  var job = this;
  Script.findById(job.script_id,function(error,script){
    if(error) {
      debug.error('fetch error %j',error);
      return next(null);
    }

    var pub = {
      id : job._id,
      task_id : job.task_id,
      host_id : job.host_id,
      user_id : job.user_id,
      customer_id : job.customer_id,
      customer_name : job.customer_name,
      name : job.name,
      notify : job.notify,
      state : job.state,
      result : job.result,
      creation_date : job.creation_date
    };

    if(script) {
      pub.script_id = script._id;
      pub.script_md5 = script.md5;
      pub.script_arguments = job.script_arguments;
    }
    next(pub);
  });
};

/**
 * create a job from a dynamic task or macro generated from a script
 */
EntitySchema.statics.createMacro = function(input,next){
  var job = new this();
  job.task_id = null ;
  job.host_id = input.host._id ;
  job.customer_id = input.host.customer_id;
  job.customer_name = input.host.customer_name;
  job.script_id = input.script_id ;
  job.script_arguments = input.script_arguments ;
  job.user_id = input.user._id;
  job.name = "macro job" ;
  job.state = 'new' ;
  job.notify = true ;
  job.save();

  if(next) next(job);
  return job ;
}

/**
* custom static constructor
*/
EntitySchema.statics.create = function(input,next)
{
  var task = input.task ;

  var job = new this();
  job.task_id = task._id ;
  job.host_id = task.host_id ;
  job.script_id = task.script_id ;
  job.script_arguments = task.script_arguments ;
  job.user_id = input.user._id;
  job.name = task.name ;
  job.customer_id = input.customer._id;
  job.customer_name = input.customer.name;
  job.state = 'new' ;
  job.notify = true ;
  job.save();

  if(next) next(job);
  return job ;
};

EntitySchema.statics.createAgentConfigUpdate = function(host_id,next) {
  var job = new this();
  job.host_id = host_id;
  job.task_id = 'agent:config:update';
  job.name = 'agent:config:update';
  job.user_id = 0;
  job.state = 'new' ;
  job.notify = false ;
  job.script_id = undefined;
  job.customer_id = undefined;
  job.customer_name = undefined;
  job.save();

  if(next) next(job);
  return job ;
}

var Entity = mongodb.db.model('Job', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
