"use strict";

var appRoot = __dirname + '/../../core';
var lodash = require('lodash');
var debug = require('debug')('eye:deploy');

var mongodb = require( appRoot + '/lib/mongodb' ).connect(() => {

  var Event = require( appRoot + '/entity/event' );
  var Monitor = require( appRoot + '/entity/monitor' ).Entity;
  var Task = require( appRoot + '/entity/task' ).Entity;
  require( appRoot + '/entity/task' );
  require( appRoot + '/entity/task/scraper' );


  var completed = lodash.after( 2, () => process.exit(0) );


  Monitor.find().populate('resource').exec( (err, monitors) => {
    if(err) throw err;

    var debug = require('debug')('eye:deploy:monitor-event');

    var next = lodash.after(monitors.length, () => completed());

    monitors.forEach( m => {
      debug('creating monitor event %s/%s', m._id, m.name);
      if( ! m.resource ){
        debug('ERROR monitor resource cannot be found');
        return next();
      }

      var event = new Event.MonitorEvent({
        customer: m.resource.customer_id,
        emitter: m
      });

      event.save( err => {
        if(err) debug(err);
        else debug('CREATED monitor event %s/%s', m._id, m.name);
        next();
      });
    });
  });


  Task.find().exec( (err, tasks) => {
    if(err) throw err;

    var debug = require('debug')('eye:deploy:task-event');

    var next = lodash.after(tasks.length, () => completed());

    tasks.forEach( t => {
      debug('creating task event %s/%s', t._id, t.name);

      var event = new Event.TaskEvent({
        customer: t.customer_id,
        emitter: t
      });

      event.save( err => {
        if(err) debug(err);
        else debug('CREATED task event %s/%s', t._id, t.name);
        next();
      });
    });
  });


});
