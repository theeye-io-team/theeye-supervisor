'use strict'

const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const Host = require('../host').Entity

var Schema = BaseSchema.extend({
  host_id: { type: String },
  template_id: { type: ObjectId },
  type: { type: String, default: 'scraper' },
  // relations
  host: { type: ObjectId, ref: 'Host' },
  template: { type: ObjectId, ref: 'TaskTemplate' },
  // scraper properties
  url: { type: String, required: true },
  method: { type: String, required: true },
  body: { type: String },
  parser: { type: String },
  pattern: { type: String },
  timeout: { type: Number },
  status_code: { type: Number },
  gzip: { type: Boolean },
  json: { type: Boolean },
})

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
}

Schema.methods.templateProperties = function () {
  let values = BaseSchema.methods.templateProperties.apply(this,arguments)
  values.url = this.url 
  values.method = this.method 
  values.timeout = this.timeout 
  values.body = this.body 
  values.gzip = this.gzip 
  values.json = this.json 
  values.status_code = this.status_code 
  values.parser = this.parser 
  values.pattern = this.pattern 
  return values
}

var Entity = mongodb.model('ScraperTask', Schema);
Entity.ensureIndexes();

exports.Entity = Entity;
