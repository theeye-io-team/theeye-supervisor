"use strict";

const mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var afterInsert = require('./afterInsert');
var afterRemove = require('./afterRemove');

var Webhook = mongodb.model('Webhook', new BaseSchema());
Webhook.ensureIndexes();

// called both insert and update and create
Webhook.on('afterSave', function(model) {
  model.last_update = new Date();
  // do stuff
});

Webhook.on('afterInsert', afterInsert);
Webhook.on('afterRemove', afterRemove);

exports.Webhook = Webhook;
