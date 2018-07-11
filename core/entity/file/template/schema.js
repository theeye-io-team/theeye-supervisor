const BaseSchema = require('../../base-schema') // entity/base-schema.js
const util = require('util')
const ObjectId = require('mongoose').Schema.Types.ObjectId

const properties = require('../schema-properties') // entity/task/base-properties.js

function TemplateSchema (props) {
  props||(props={})

  const specs = {
    collection: 'file_templates',
    discriminatorKey: '_type'
  }

  const calcProps = Object.assign({}, properties, {
    //data: Buffer,
    data: String,
    source_model_id: { type: ObjectId }, // if provided, is a reference to the original model
    hostgroup_id: { type: ObjectId },
    hostgroup: { type: ObjectId, ref: 'HostGroup' }, // belongs to
  }, props)

  BaseSchema.call(this, calcProps, specs)

  return this
}

util.inherits(TemplateSchema, BaseSchema)

module.exports = TemplateSchema
