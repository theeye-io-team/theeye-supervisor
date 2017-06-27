'use strict'

const util = require('util')
const ApplicationSchema = require('../base-schema')
const lifecicle = require('mongoose-lifecycle')

function HostSchema () {
  const properties = {
    hostname: { type: String, index: true, required: true },
    ip: { type: String },
    os_name: { type: String },
    os_version: { type: String },
    agent_version: { type: String },
    customer_name: { type: String, index: true },
    customer_id: { type: String }, // Host customer_id is a String , will be replaced
    //templates: [{ type: ObjectId, ref: 'HostGroup' }] // can belongs to many hostgroups templates
  }

  // Schema constructor
  ApplicationSchema.call(this, properties, {
    collection: 'hosts',
    discriminatorKey: '_type'
  })

  return this
}

util.inherits(HostSchema, ApplicationSchema)

module.exports = HostSchema
