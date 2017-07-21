'use strict'

const util = require('util')
const BaseSchema = require('../base-schema')

function HostSchema () {
  const properties = {
    hostname: { type: String, index: true, required: true },
    ip: { type: String },
    os_name: { type: String },
    os_version: { type: String },
    agent_version: { type: String },
    customer_name: { type: String, index: true },
    customer_id: { type: String }, // Host customer_id is a String , will replace base-schema customer_id
    //templates: [{ type: ObjectId, ref: 'HostGroup' }] // can belongs to many hostgroups templates
  }

  // Schema constructor
  BaseSchema.call(this, properties, {
    collection: 'hosts',
    discriminatorKey: '_type'
  })

  return this
}

util.inherits(HostSchema, BaseSchema)

module.exports = HostSchema
