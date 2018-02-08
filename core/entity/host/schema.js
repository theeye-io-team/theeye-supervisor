'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const util = require('util')
const BaseSchema = require('../base-schema')

const NgrokIntegrationSchema = new Schema({
  active: {
    type: Boolean,
    default: false
  },
  url: {
    type: String,
    default: ''
  },
  last_update: {
    type: Date,
    default: Date.now
  },
  last_job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NgrokIntegrationJob',
    default: null
  },
  last_job_id: {
    type: String,
    default: ''
  }
},{ _id : false })

const IntegrationsSchema = new Schema({
  ngrok: {
    type: NgrokIntegrationSchema,
    default: () => {
      return {}
    }
  }
},{ _id : false })

function HostSchema () {
  const properties = {
    hostname: { type: String, index: true, required: true },
    ip: { type: String },
    os_name: { type: String },
    os_version: { type: String },
    agent_version: { type: String },
    customer_name: { type: String, index: true },
    customer_id: { type: String }, // Host customer_id is a String , will replace base-schema customer_id
    integrations: {
      type: IntegrationsSchema,
      default: () => {
        return {}
      }
    }
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
