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
AgentUpdateJobSchema.statics.create = function (specs,next) {
  next || (next=()=>{})

  const self = this
  self.find({
    host_id: specs.host_id,
    state: 'new'
  }).exec((err, jobs) => {

    // check if there are update jobs already created for this host
    if (jobs.length !== 0) {
      // return any job
      return next(null, jobs[0])
    }

    const job = new self(specs)
    job.host = specs.host_id // enforce host_id, just to be redundant
    job.save(err => {
      if (err) {
        logger.error(err)
        return next(err)
      }
      next(null,job)
    })
  })
}

module.exports = AgentUpdateJobSchema;
