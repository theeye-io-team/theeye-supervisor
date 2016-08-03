"use strict";

var Job = require( process.env.BASE_PATH + '/entity/job' ).Entity;
var async = require('async');
var NotificationService = require('./notification');

const JOB_UPDATE_AGENT_CONFIG = 'agent:config:update';

const STATUS_AGENT_UPDATED = 'agent-updated';
const STATUS_JOB_COMPLETED = 'job-completed';

var service = {
  fetchBy(input,next) {
    var query = {};

    if( input.host ) query.host_id = input.host._id ;
    if( input.state ) query.state = input.state ;

    Job.find(query,function(error, jobs){
      next( jobs );
    });
  },
  getNextPendingJob(input,next) {
    var query = {};
    query.state = "new";
    query.host_id = input.host._id;

    Job.findOne(query,function(error,job){
      if( job != null ) {
        job.state = "sent";
        job.save(error => {
          if(error) throw error;
          job.publish(pub => next(null,pub));
        });
      }
      else next(null,null);
    });
  },
  updateResult(job,result,done) {
    if( job.name == JOB_UPDATE_AGENT_CONFIG ) {
      job.state = STATUS_AGENT_UPDATED;
    } else {
      job.state = STATUS_JOB_COMPLETED;
    }

    job.result = result;
    job.save( error => done(error) );

    // notify job result to clients
    if( job.notify ) {
      NotificationService.sendSNSNotification(
        job,{
          topic:"jobs",
          subject:"job_update"
        }
      );

      job.populate('user',error => {
        var stdout, stderr, code, result = job.result;

        if(result){
          stdout = result.stdout?result.stdout.trim():'no stdout';
          stderr = result.stderr?result.stderr.trim():'no stderr';
          code = result.code||'no code';
        }

        NotificationService.sendEmailNotification({
          customer_name: job.customer_name,
          subject: `[Sript] ${job.name}`,
          content:
            `<h3>Execution completed.</h3><ul>
            <li>stdout : ${stdout}</li>
            <li>stderr : ${stderr}</li>
            <li>code : ${code}</li>
            </ul>`,
          to: job.user.email
        });
      });
    }
  }
};

module.exports = service ;
