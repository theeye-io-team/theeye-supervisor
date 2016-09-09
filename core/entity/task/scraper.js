"use strict";

var mongodb = require('../../lib/mongodb').db;
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var TaskSchema = require('./index').TaskSchema;

/** Entity properties **/
var properties = {
  url: { type: String, 'default': null, required:true },
  method: { type: String, 'default': null, required:true },
  external: { type: Boolean, 'default': null },
  timeout: { type: Number, 'default': null },
  body: { type: String, 'default': null },
  gzip: { type: Boolean, 'default': null },
  json: { type: Boolean, 'default': null },
  status_code: { type: Number, 'default': null },
  parser: { type: String, 'default': null },
  pattern: { type: String, 'default': null },
  type: { type: String, 'default': 'scraper' }
};


/** Schema **/
var EntitySchema = TaskSchema.extend(properties);

var Entity = mongodb.model('ScraperTask', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
