
const mongoose = require('mongoose')
const ObjectId = require('mongoose').Schema.Types.ObjectId
const Schema = mongoose.Schema
const util = require('util')
const BaseSchema = require('../base-schema')

function HostSchema () {
  const properties = {
    disabled: { type: Boolean },
    hostname: { type: String, index: true, required: true },
    customer_name: { type: String, index: true },
    customer_id: { type: String }, // Host customer_id is a String , will replace base-schema customer_id
    fingerprints: [ FingerprintSchema ]
  }

  // Schema constructor
  BaseSchema.call(this, properties, {
    collection: 'hosts',
    discriminatorKey: '_type'
  })

  return this
}

const FingerprintSchema = new Schema({
  creation_date: Date,
  fingerprint: String, // calculated data. can be recalculated using information below
  platform: String,
  hostname: String,
  type: String,
  release: String,
  arch: String,
  totalmem: String,
  user: String,
  cpu: [ Object ],
  net: [ Object ],
  cwd: String,
  agent_version: String,
  agent_username: String,
  extras: {
    user: Object,
    agent_pid: String
  }
})

//const NgrokIntegrationSchema = new Schema({
//  active: { type: Boolean, default: false },
//  url: { type: String, default: '' },
//  last_update: { type: Date, default: Date.now },
//  last_job: {
//    type: mongoose.Schema.Types.ObjectId,
//    ref: 'NgrokIntegrationJob',
//    default: null
//  },
//  last_job_id: { type: String, default: '' }
//},{ _id : false })
//
//const IntegrationsSchema = new Schema({
//  ngrok: {
//    type: NgrokIntegrationSchema,
//    default: () => {
//      return {}
//    }
//  }
//},{ _id : false })


util.inherits(HostSchema, BaseSchema)

module.exports = HostSchema
