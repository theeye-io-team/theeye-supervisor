'use strict'

const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const Host = require('../host').Entity

var Schema = BaseSchema.extend({
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'DummyTaskTemplate' },
  type: { type: String, default: 'dummy' },
})

var Entity = mongodb.model('DummyTask', Schema);
Entity.ensureIndexes();

exports.Entity = Entity;
