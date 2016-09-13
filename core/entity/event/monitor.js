"use strict";
var Schema = require('mongoose').Schema;
var mongodb = require('../../lib/mongodb').db;
var EventSchema = require('./schema').EntitySchema;

var MonitorSchema = EventSchema.extend({
  emitter: { type: Schema.Types.ObjectId, ref: 'ResourceMonitor' },
});

var Entity = mongodb.model('MonitorEvent', MonitorSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
