const ObjectId = require('mongoose').Schema.Types.ObjectId
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')
const logger = require('../../lib/logger')('eye:entity:monitor')

/** Extended Schema. Includes non template attributes **/
const MonitorSchema = new BaseSchema({
  host_id: { type: String },
  resource_id: { type: String, required: true },
  template_id: { type: ObjectId },
  enable: { type: Boolean, default: true },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  template: { type: ObjectId, ref: 'MonitorTemplate' }, // has one
  host: { type: ObjectId, ref: 'Host' }, // belongs to
  resource: { type: ObjectId, ref: 'Resource' }, // belongs to
  _type: { type: String, 'default': 'ResourceMonitor' }
}, { collection: 'resourcemonitors' })

module.exports = MonitorSchema

/**
 * extends publishing method to include Entity specific definitions
 */
MonitorSchema.methods.publish = function (options, next) {
  options = options || {};
  if (options.populate) {
    this.populate({ path:'resource' }, function (error, monitor) {
      if (!monitor.resource) {
        logger.error('monitor.resource is null. could not populate');
        next(error);
      } else {
        next(error,monitor.toObject());
      }
    })
  } else {
    next(null, this.toObject());
  }
}

MonitorSchema.methods.templateProperties = function() {
  let values = this.toObject()

  values.source_model_id = this._id
  delete values.customer
  delete values.customer_id
  delete values.customer_name

  return values
}
