"use strict";

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const config = require('config');

const Task = require('../../entity/task');

class EventDispatcher extends EventEmitter {

  constructor ( options ) {
    super();
  }

  dispatch ( event ) {

    Task.find({
      triggers: event
    },function(err, tasks){

    });

    return this;
  }

}


module.exports = new EventDispatcher( config.event_dispatcher );
