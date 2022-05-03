const App = require('../../app')
const util = require('util')
const logger = require('../../lib/logger')('entity:task:schema')
const BaseSchema = require('../base-schema')
const Fingerprint = require('../../lib/fingerprint')
const properties = require('./base-properties')

function TaskSchema (props, specs) {
  props || (props={})
  specs = specs || { collection: 'tasks' }

  // Schema constructor
  BaseSchema.call(this, Object.assign({}, properties, props), specs)

  const def = {
    getters: true,
    virtuals: true,
    transform (doc, ret, options) {
      ret.id = ret._id
      delete ret._id
      delete ret.__v
      delete ret.secret
    }
  }

  this.set('toJSON', def)
  this.set('toObject', def)

  this.methods.templateProperties = function () {
    let values = this.toObject()
    values.source_model_id = this._id

    // remove non essential properties
    delete values.enable
    delete values.creation_date
    delete values.last_update
    delete values.triggers
    delete values.id
    delete values.host
    delete values.host_id
    delete values.secret
    delete values.acl
    delete values.customer
    delete values.customer_id
    delete values.workflow
    delete values.workflow_id
    delete values.execution_count
    delete values.template
    delete values.template_id
    delete values.fingerprint
    // @todo script and script_is are required for templates creation. this dependency must be removed later
    //delete values.script
    //delete values.script_id
    return values
  }

  this.methods.calculateFingerprint = function (namespace) {
    const props = [
      'customer_id',
      'type',
      'name',
    ]

    const payload = []
    for (let index = 0; index < props.length; index++) {
      const prop = props[index]
      payload.push( this[prop] )
    }

    return Fingerprint.payloadUUID(namespace, payload)
  }

  this.pre('save', function(next) {
    if (this.isNew) {
      this.fingerprint = this.calculateFingerprint(App.namespace)
    }

    this.last_update = new Date()
    // do stuff
    next()
  })

  return this
}

util.inherits(TaskSchema, BaseSchema)

module.exports = TaskSchema
