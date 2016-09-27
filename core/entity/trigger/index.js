"use strict";

const mongodb = require('../../lib/mongodb').db;

var BaseSchema = require('./schema');

// default Event does not have a default Emitter
var Trigger = mongodb.model('Trigger', new BaseSchema());

Trigger.ensureIndexes();

exports.Trigger = Trigger;
