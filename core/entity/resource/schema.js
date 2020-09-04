const util = require('util')
const Schema = require('mongoose').Schema
const Constants = require('../../constants/monitors')
const FetchBy = require('../../lib/fetch-by')
const lifecicle = require('mongoose-lifecycle')

const properties = {
  order: { type: Number, default: 0 },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  description: { type: String },
  name: { type: String, required: true },
  type: { type: String, required: true },
  acl: [{ type: String }],
  failure_severity: { type: String, default: Constants.MONITOR_SEVERITY_HIGH },
  alerts: { type: Boolean, default: true },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now }
}

function BaseSchema (props, opts) {
  props || (props={})

  const specs = {
    collection: opts.collection || 'resources',
    discriminatorKey: '_type'
  }

  Schema.call(this, Object.assign({}, properties, props), specs)

  this.plugin(lifecicle)

  // Duplicate the ID field.
  this.virtual('id').get(function(){
    return this._id.toHexString()
  })

  const def = {
    getters: true,
    virtuals: true,
    transform: function (doc, ret, options) {
      ret.id = ret._id
      delete ret.__v
    }
  }

  this.set('toJSON'  , def)
  this.set('toObject', def)


  this.statics.fetchBy = function (filter, next) {
    FetchBy.call(this, filter, next)
  }

  this.methods.publish = function (next) {
    var data = this.toObject()
    if (next) { next(null,data) }
    return data
  }

  // NOTE: This will break Monitoring service. should use another property
  //this.pre('save', function(next) {
  //  this.last_update = new Date()
  //  // do stuff
  //  next()
  //})
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
