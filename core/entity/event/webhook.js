"use strict";
var Schema = require('mongoose').Schema;
var mongodb = require('../../lib/mongodb').db;
var EventSchema = require('./schema').EntitySchema;

var WebhookSchema = EventSchema.extend({
  emitter: { type: Schema.Types.ObjectId, ref: 'Webhook' },
});

var Entity = mongodb.model('WebhookEvent', WebhookSchema);
Entity.ensureIndexes();

exports.Entity = Entity;
