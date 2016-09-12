"use strict";
var Schema = require('mongoose').Schema;
var mongodb = require('../../lib/mongodb').db;
var EventSchema = require('./schema').EntitySchema;

var Entity = mongodb.model('Event', EventSchema);
Entity.ensureIndexes();

exports.Event = Entity;
exports.TaskEvent = require('./task').Entity;
exports.MonitorEvent = require('./monitor').Entity;
//exports.WebhookEvent = require('./webhook').Entity;
