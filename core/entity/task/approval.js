'use strict'

const mongodb = require('../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')
const Host = require('../host').Entity

var Schema = BaseSchema.extend({
  approvers: [{ type : ObjectId, ref: 'User' }],
  template_id: { type: ObjectId },
  //approver: { type: ObjectId, ref: 'User' },
  template: { type: ObjectId, ref: 'ApprovalTaskTemplate' },
  type: { type: String, default: 'approval' },
})

var Entity = mongodb.model('ApprovalTask', Schema);
Entity.ensureIndexes();

exports.Entity = Entity;
