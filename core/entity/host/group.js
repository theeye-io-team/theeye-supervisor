"use strict"

const mongodb = require('../../lib/mongodb')
const Schema = require('mongoose').Schema
const ObjectId = Schema.Types.ObjectId
const debug = require('debug')('eye:entity:host:group')
const BaseSchema = require('../base-schema')

const TriggerTemplate = new Schema({
  emitter_id: { type: Schema.Types.ObjectId },
  emitter_type: { type: 'String' },
  task: { type: Schema.Types.ObjectId, ref: 'TaskTemplate' },
  task_id: { type: Schema.Types.ObjectId },
  event_type: { type: String },
  event_name: { type: String },
})

const properties = {
  hostname_regex: { type: String },
  name: { type: String },
  description: { type: String },
  enable: { type: Boolean, default: true },
  customer_id: { type: ObjectId, required: true, index: true },
  customer_name: { type: String },
  customer: { type: ObjectId, ref: 'Customer' }, // belongs to
  hosts: [{ type: ObjectId, ref: 'Host' }], // has many
  tasks: [{ type: ObjectId, ref: 'TaskTemplate' }], // has many
  resources: [{ type: ObjectId, ref: 'ResourceTemplate' }], // has many
  files: [{ type: ObjectId, ref: 'FileTemplate' }], // has many
  triggers: [ TriggerTemplate ], // has many
  _type: { type: String, default: 'HostGroup' }
}

const EntitySchema = new BaseSchema(properties,{
  collection: 'host_templates',
  discriminatorKey: '_type'
})

EntitySchema.methods.populateAll = function(next) {
  Entity.populate(this, [
    { path: 'customer' },
    { path: 'hosts' },
    { path: 'tasks' },
    { path: 'files' },
    { path: 'resources' },
    {
      path: 'triggers.task',
      select: 'name type' // only populate this fields
    },
  ], (err, group) => {
    return next(err, group)
  })
}

var Entity = mongodb.db.model('HostGroup', EntitySchema)
exports.Entity = Entity
