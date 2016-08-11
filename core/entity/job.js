var mongodb = require('../lib/mongodb');
var Schema = require('mongoose').Schema;
var Script = require('./script').Entity;
var ObjectId = Schema.Types.ObjectId;

var EntitySchema = Schema({
  task_id: { type: String, ref:'Task' },
  host_id: { type: String, ref:'Host' },
  script_id: { type: String, ref:'Script' },
  customer_id: { type:String, ref:'Customer' },
  user_id: { type: String },
  user: { type: ObjectId, ref:'User' },
  script_arguments: { type: Array, default: [] },
  customer_name: { type : String },
  name: { type: String },
  notify: { type: Boolean },
  state: { type: String },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  result: { type: Object, default: {} },
  task: { type: Object },
  script: { type: Object },
});

var debug = require('../lib/logger')('eye:supervisor:entity:job');

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
  job.user = input.user;
  job.name = "macro job" ;
  job.state = 'new' ;
  job.notify = true ;
  job.save();

  if(next) next(job);
  return job ;
}

EntitySchema.statics.createAgentConfigUpdate = function(host_id,next) {
  var job = new this();
  job.host_id = host_id;
  job.task_id = 'agent:config:update';
  job.name = 'agent:config:update';
  job.user = 0;
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
		delete ret.__v;
	}
}
EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);

var Entity = mongodb.db.model('Job', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
