'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const config = require('config');
const logger = require('../../lib/logger')(':events');

const User = require('../../entity/user').Entity;
const Task = require('../../entity/task').Entity;
const ObjectId = require('mongoose').Types.ObjectId;
const CustomerService = require('../customer');

const app = require('../../app');

class EventDispatcher extends EventEmitter {

  constructor ( options ) {
    super ();
    // theeye user , used to automatic jobs
    this.user = null;
  }

  initialize (done) {
    function next(){
      logger.log('started');
      done();
    }
    if( this.user ){
      next(null,user);
    } else {
      User.findOne(config.system.user,(err, user) => {
        if (err) throw err;
        if (!user) {
          this.user = new User(config.system.user);
          this.user.save( err => {
            if(err) throw err;
            else next(null, user);
          });
        } else {
          this.user = user;
          next(null, user);
        }
      });
    }
  }

  /**
   * @param {Event} event an event entity to dispatch
   * @param {Object} event_data event extra data generated
   */
  dispatch (event, event_data) {
    event_data||(event_data=null);

    logger.log(
      'new event id %s name %s , type %s , emitter %s',
      event._id, event.name, event._type, event.emitter
    );

    Task.find({
      triggers: event._id
    },(err, tasks) => {
      if (err) return logger.error( err );
      if (tasks.length == 0) return;

      tasks.forEach(task => createJob.call(this, {
        task: task,
        event: event,
        event_data: event_data
      }));
    });

    return this;
  }
}

/**
 * @author Facugon
 * @param {Array options}
 * @access private
 */
function createJob ( options ) {
  var task = options.task,
    event = options.event;

  logger.log('preparing to run task %s', task._id);

  task.populate([
    {path:'customer_id'},
    {path:'host'}
  ],err => {
    if (err) return logger.error(err);
    if (!task.customer_id) return logger.error('FATAL. task %s does not has a customer', task._id);
    if (!task.host) return logger.error('WARNING. task %s does not has a host. cannot execute', task._id);

    var customer = task.customer_id; //after populate customer_id is a customer model
    if (!customer) {
      return logger.error(
        new Error('task customer is not set, %j', task)
      );
    }

    var runDateMilliseconds =  Date.now() + task.grace_time * 1000 ;

    if( task.grace_time > 0 ){
      // schedule the task
      app.scheduler.scheduleTask({
        event: event,
        task: task,
        user: this.user,
        customer: customer,
        notify: true,
        schedule: {
          runDate: runDateMilliseconds,
        }
      },(err, agenda) => {
        if (err) return logger.error(err);

        CustomerService.getAlertEmails(customer.name,(err, emails)=>{
          app.jobDispatcher.sendJobCancelationEmail({
            task_secret: task.secret,
            task_id: task.id,
            schedule_id: agenda.attrs._id,
            task_name: task.name,
            hostname: task.host.hostname,
            date: new Date(runDateMilliseconds).toISOString(),
            grace_time_mins: task.grace_time / 60,
            customer_name: customer.name,
            to: emails.join(',')
          });
        });
      });
    } else {
      app.jobDispatcher.create({
        event: event,
        task: task,
        user: this.user,
        customer: customer,
        notify: true
      }, (err, job) => {
        if (err) return logger.error(err);
        // job created
        logger.log('automatic job created by event');
      });
    }
  });
}


module.exports = new EventDispatcher();
