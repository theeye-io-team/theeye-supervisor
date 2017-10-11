"use strict";

const BaseSchema = require('./schema');
const Job = require('./index');
const logger = require('../../lib/logger');
const LIFECYCLE = require('../../constants/lifecycle')
const JOBS = require('../../constants/jobs')

const AgentUpdateJobSchema = new BaseSchema({
  name: { type: String, default: JOBS.AGENT_UPDATE },
  lifecycle: { type: String, default: LIFECYCLE.READY },
  notify: { type: Boolean, default: false },
});

/**
 * create a job from a dynamic task or macro generated from a script
 */
AgentUpdateJobSchema.statics.create = function (specs, next) {
  next || (next=()=>{})

  const Job = this
  const query = Job.find({
    host_id: specs.host_id,
    lifecycle: LIFECYCLE.READY
  })

  // check if there are update jobs already created for this host
  query.exec((err, jobs) => {
    if (jobs.length !== 0) {
      // return any job
      return next(null, jobs[0])
    }

    Job.remove({ host_id: specs.host_id }, err => {
      if (err) {
        logger.error('Failed to remove old agent update jobs for host %s',specs.host_id)
        logger.error(err)
      }
    })

    const job = new Job(specs)
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
