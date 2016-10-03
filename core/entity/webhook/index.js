"use strict";

const mongodb = require('../../lib/mongodb').db;
const Schema = require('mongoose').Schema;
var BaseSchema = require('./schema');
var afterInsert = require('./afterInsert');
var afterRemove = require('./afterRemove');

var Webhook = mongodb.model('Webhook',
  new BaseSchema({
    _type: { type: String, 'default': 'Webhook' }
  })
);

Webhook.ensureIndexes();

// called both insert and update and create
Webhook.on('afterSave', function(model) {
  model.last_update = new Date();
  // do stuff
});

Webhook.on('afterInsert', afterInsert);
Webhook.on('afterRemove', afterRemove);

exports.Webhook = Webhook;
