"use strict";

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const config = require('config').events ;
const logger = require('../../lib/logger')('eye:events');

const User = require('../../entity/user').Entity;
const Task = require('../../entity/task').Entity;
const JobDispatcher = require('../job');
const Scheduler = require('../scheduler');
const ObjectId = require('mongoose').Types.ObjectId;

class EventDispatcher extends EventEmitter {
  constructor ( options ) {
    super();
    // theeye user , used to automatic jobs
    this.user = null;
  }

  initialize (next) {
    if( this.user ){
      next(null,user);
    } else {
      User.findOne(config.user,(err, user) => {
        if(err) throw err;
        if(!user) {
          this.user = new User(config.user);
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

  dispatch ( event ) {
    logger.log(
      'new event id %s name %s , type %s , emitter %s',
      event._id, event.name, event._type, event.emitter
    );

    Task.find({
      triggers: event._id
    },(err, tasks) => {
      if( err ) return logger.error( err );
      if( tasks.length == 0 ) return;

      tasks.forEach( task => this.prepareTask(task) );
    });

    return this;
  }

  prepareTask ( task ) {
    logger.log('preparing to run task');
    task.populate('customer_id', err => {
      if(err){
        return logger.error(err);
      }

      var customer = task.customer_id; //after populate customer_id is a customer model
      if(!customer){
        return logger.error(
          new Error('task customer is not set, %j', task)
        );
      }

      if( task.grace_time > 0 ){
        // schedule the task
      } else {
        JobDispatcher.create({
          task: task,
          user: this.user,
          customer: customer,
          notify: true
        }, (err, job) => {
          if(err) logger.error(err);
          // job created
          else logger.log('automatic job created by event');
        });
      }
    })
  }
}

module.exports = new EventDispatcher();
