"use strict";

const BaseSchema = require('./schema');
const Job = require('./index');

var ScriptSchema = new BaseSchema({
  script_id: { type: String },
  script_arguments: { type: Array, 'default': [] },
  script: { type: Object }, // embedded
});

/*
ScriptSchema.statics.createMacro = function(input,next){
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
*/

var ScriptJob = Job.discriminator('ScriptJob', ScriptSchema);

ScriptJob.ensureIndexes();

module.exports = ScriptJob;
