"use strict";

const Schema = require('mongoose').Schema;
const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');

var EventSchema = new BaseSchema({
  emitter: {
    type: Schema.Types.ObjectId,
    ref: 'ResourceMonitor'
  }
});

module.exports = EventSchema;
