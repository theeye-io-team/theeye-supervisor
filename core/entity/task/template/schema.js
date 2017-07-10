'use strict';

const BaseSchema = require('../../base-schema') // entity/base-schema.js
const util = require('util')
const ObjectId = require('mongoose').Schema.Types.ObjectId

// extend base task properties
const properties = require('../base-properties') // entity/task/base-properties.js

function TemplateSchema (props) {
  props||(props={})

  const specs = {
    collection: 'task_templates',
    discriminatorKey: '_type'
  }

  const calcProps = Object.assign({}, properties, {
    source_model_id: { type: ObjectId }, // if provided, is a reference to the source model. beware, won't be valid forever (eg. if the source model is deleted)
    hostgroup_id: { type: ObjectId },
    hostgroup: { type: ObjectId, ref: 'HostGroup' }, // belongs to
  }, props)

  BaseSchema.call(this, calcProps, specs)

  return this
}

util.inherits(TemplateSchema, BaseSchema)

module.exports = TemplateSchema
