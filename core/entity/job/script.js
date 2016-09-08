var JobSchema = require('./index').EntitySchema;
var mongodb = require('../../lib/mongodb').db;

var ScriptJobSchema = JobSchema.extend({
  script_id: { type: String },
  script_arguments: { type: Array, 'default': [] },
  script: { type: Object }, // embedded
});

ScriptJobSchema.statics.createMacro = function(input,next){
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

var Job = mongodb.model('ScriptJob', ScriptJobSchema);
Job.ensureIndexes();

exports.Entity = Job;
