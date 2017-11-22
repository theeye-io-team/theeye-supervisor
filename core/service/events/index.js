'use strict';

const EventEmitter = require('events').EventEmitter
const util = require('util')
const config = require('config')
const ObjectId = require('mongoose').Types.ObjectId

const App = require('../../app')
const logger = require('../../lib/logger')(':events')
const User = require('../../entity/user').Entity
const Task = require('../../entity/task').Entity
const CustomerService = require('../customer')
const JobConstants = require('../../constants/jobs')

class EventDispatcher extends EventEmitter {

  constructor ( options ) {
    super ()
    // theeye user , used to automatic jobs
    this.user = null
  }

  initialize (done) {
    const next = () => {
      logger.log('events dispatcher is ready')
      done()
    }

    if (this.user) {
      return next(null,user)
    } else {
      User.findOne(config.system.user,(err, user) => {
        if (err) throw err;
        if (!user) {
          // system user not found. create one
          this.user = new User(config.system.user)
          this.user.save( err => {
            if (err) throw err
            else next(null, this.user)
          });
        } else {
          this.user = user
          next(null, user)
        }
      });
    }
  }

  /**
   * @param {Event} event an event entity to dispatch
   * @param {Object} event_data event extra data generated
   */
  dispatch (event, event_data, done) {
    event_data || (event_data=null)
    done || (done=()=>{})

    logger.log(
      'new event id %s name %s , type %s , emitter %s',
      event._id, event.name, event._type, event.emitter
    );

    Task.find({ triggers: event._id }, (err, tasks) => {
      if (err) {
        logger.error(err)
        done(err)
      }

      if (tasks.length == 0) return done()

      for (var i=0; i<tasks.length; i++) {
        createJob({
          user: this.user,
          task: tasks[i],
          event: event,
          event_data: event_data
        })
      }

      done(null, tasks)
    })

    return this
  }
}

module.exports = new EventDispatcher()

/**
 * @author Facugon
 * @param {Mixed[]} input
 * @property {Task} input.task
 * @property {User} input.user
 * @property {Event} input.event
 * @access private
 */
const createJob = (input) => {
  const task = input.task
  const user = input.user
  const event = input.event

  logger.log('preparing to run task %s', task._id)

  task.populate([
    { path: 'customer' },
    { path: 'host' }
  ], err => {
    if (err) {
      logger.error(err)
      return
    }
    if (!task.customer) {
      logger.error('FATAL. Task %s does not has a customer', task._id)
      return
    }
    if (!task.host) {
      logger.error('WARNING. Task %s does not has a host. Cannot execute', task._id)
      return
    }

    const customer = task.customer
    const runDateMilliseconds =  Date.now() + task.grace_time * 1000

    if (task.grace_time > 0) {
      // schedule the task
      App.scheduler.scheduleTask({
        event: event,
        task: task,
        user: user,
        customer: customer,
        notify: true,
        schedule: {
          runDate: runDateMilliseconds
        },
        origin: JobConstants.ORIGIN_WORKFLOW
      }, (err, agenda) => {
        if (err) return logger.error(err)

        CustomerService.getAlertEmails(customer.name,(err, emails)=>{
          App.jobDispatcher.sendJobCancelationEmail({
            task_secret: task.secret,
            task_id: task.id,
            schedule_id: agenda.attrs._id,
            task_name: task.name,
            hostname: task.host.hostname,
            date: new Date(runDateMilliseconds).toISOString(),
            grace_time_mins: task.grace_time / 60,
            customer_name: customer.name,
            to: emails.join(',')
          })
        })
      })
    } else {
      App.jobDispatcher.create({
        event: event,
        task: task,
        user: user,
        customer: customer,
        notify: true,
        origin: JobConstants.ORIGIN_WORKFLOW
      }, (err, job) => {
        if (err) return logger.error(err);
        // job created
        logger.log('job created by workflow')
      })
    }
  })
}
