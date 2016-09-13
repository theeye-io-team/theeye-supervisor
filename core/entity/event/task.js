"use strict";
var Schema = require('mongoose').Schema;
var mongodb = require('../../lib/mongodb').db;
var EventSchema = require('./schema').EntitySchema;

var TaskSchema = EventSchema.extend({
  emitter: { type: Schema.Types.ObjectId, ref: 'Task' },
});

var Entity = mongodb.model('TaskEvent', TaskSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
