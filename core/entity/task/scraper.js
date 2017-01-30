"use strict";

var mongodb = require('../../lib/mongodb').db;
var ObjectId = require('mongoose').Schema.Types.ObjectId;
var BaseSchema = require('./schema');
var Host = require('../host').Entity;

/** Schema **/
var Schema = BaseSchema.extend({
  host_id: { type: String, 'default': null },
  host: { type: ObjectId, ref: 'Host', 'default': null },
  template: { type: ObjectId, ref: 'TaskTemplate', 'default': null },
  type: { type: String, 'default': 'scraper' },
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
});

Schema.methods.publish = function(next) {
  var data = this.toObject();
  if (!this.host_id) {
    return next(data);
  } else {
    Host.findById(this.host_id, function(err,host){
      if (err||!host) return next(data);
      else {
        data.hostname = host.hostname;
        return next(data);
      }
    });
  }
};

var Entity = mongodb.model('ScraperTask', Schema);
Entity.ensureIndexes();

exports.Entity = Entity;
