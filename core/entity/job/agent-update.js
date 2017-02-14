"use strict";

const BaseSchema = require('./schema');
const Job = require('./index');
const logger = require('../../lib/logger');

var AgentUpdateJobSchema = new BaseSchema({
  name: { type: String, default: 'agent:config:update' },
  state: { type: String, default: 'new' },
  notify: { type: Boolean, default: false },
});

/**
 * create a job from a dynamic task or macro generated from a script
 */
AgentUpdateJobSchema.statics.create = function(specs,next) {
  next||(next=()=>{});
  var Job = this;
  Job.find({
    host_id: specs.host_id,
    state: 'new'
  }).exec(function(err, jobs){

    if( jobs.length != 0 ){
      // return any job
      return next(null,jobs[0]);
    }

    var job = new Job(specs);
    job.host = specs.host_id;
    job.save(err => {
      if(err) logger.error(err);
      next(err,job);
    });
  });
}

module.exports = AgentUpdateJobSchema;
