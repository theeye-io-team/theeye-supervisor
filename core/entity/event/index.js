"use strict";

const mongodb = require('../../lib/mongodb').db;

var BaseSchema = require('./schema');
var TaskEventSchema = require('./task');
var MonitorEventSchema = require('./monitor');
var WebhookEventSchema = require('./webhook');

// default Event does not have a default Emitter
var Event = mongodb.model('Event', new BaseSchema());
var TaskEvent = Event.discriminator('TaskEvent', TaskEventSchema);
var MonitorEvent = Event.discriminator('MonitorEvent', MonitorEventSchema);
var WebhookEvent = Event.discriminator('WebhookEvent', WebhookEventSchema);

Event.ensureIndexes();

exports.Event = Event;

exports.TaskEvent = TaskEvent;

exports.MonitorEvent = MonitorEvent;

exports.WebhookEvent = WebhookEvent;
