const ObjectId = require('mongoose').Schema.Types.ObjectId
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')
const logger = require('../../lib/logger')('eye:entity:monitor')

/** Extended Schema. Includes non template attributes **/
const MonitorSchema = new BaseSchema({
  order: { type: Number, default: 0 },
  host_id: { type: String },
  resource_id: { type: String, required: true },
  template_id: { type: ObjectId },
  enable: { type: Boolean, default: true },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  template: { type: ObjectId, ref: 'MonitorTemplate' }, // has one
  host: { type: ObjectId, ref: 'Host' }, // belongs to
  resource: { type: ObjectId, ref: 'Resource' }, // belongs to
  env: { type: Object, default: () => { return {} } },
  _type: { type: String, 'default': 'ResourceMonitor' }
}, { collection: 'resourcemonitors' })

module.exports = MonitorSchema

MonitorSchema.methods.templateProperties = function () {
  let values = this.toObject()
  // remove non essential properties
  delete values.enable
  delete values.creation_date
  delete values.last_update
  delete values._id
  delete values.id
  delete values.resource_id
  delete values.resource
  delete values.template
  delete values.template_id
  delete values.host_id
  delete values.host
  delete values.customer
  delete values.customer_id
  delete values.customer_name

  return values
}

MonitorSchema.methods.runOnHost = function() {
  if (this.type === 'nested') { return false }
  if (this.hasOwnProperty('host_id')) { return true }
  return true
}
