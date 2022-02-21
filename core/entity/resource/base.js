const BaseSchema = require('./schema')
const ObjectId = require('mongoose').Schema.Types.ObjectId

const INITIAL_STATE = 'normal'

const ResourceSchema = new BaseSchema({
  host_id: { type: String },
  monitor_id: { type: ObjectId },
  template_id: { type: ObjectId },
  hostname: { type: String },
  fails_count: { type: Number, default: 0 },
  recovery_count: { type: Number, default: 0 },
  state: { type: String, default: INITIAL_STATE },
  enable: { type: Boolean, default: true },
  last_event: { type: Object, default: () => { return {} } },
  last_check: { type: Date },
  monitor: { type: ObjectId, ref: 'ResourceMonitor' }, // has one
  template: { type: ObjectId, ref: 'ResourceTemplate' }, // has one
  host: { type: ObjectId, ref: 'Host' }, // belongs to
  _type: { type: String, 'default': 'Resource' }
}, { collection: 'resources' })

module.exports = ResourceSchema

ResourceSchema.methods.templateProperties = function () {
  const values = this.toObject()

  values.source_model_id = this._id
  // remove non essential properties
  delete values.enable
  delete values.monitor_id
  delete values.template
  delete values.template_id
  delete values.last_check
  delete values.last_event
  delete values.fails_count
  delete values.recovery_count
  delete values.hostname
  delete values.state
  delete values.creation_date
  delete values.last_update
  delete values._id
  delete values.id
  delete values.host_id
  delete values.host
  delete values.acl
  delete values.customer
  delete values.customer_id
  delete values.customer_name

  return values
}

//ResourceSchema.methods.populate = function(options,next){
//  return next(null,this)
//  return Entity.populate(this,[
//    { path: '' },
//  ],next)
//}

//ResourceSchema.statics.create = function(input, next){
//  var data = {}
//  next||(next=function(){})
//  var entity = new Entity(input)
//  entity.host_id = input.host_id
//  entity.hostname = input.hostname
//  entity.template = input.template || null
//  entity.save(function (err, instance) {
//    if (err) return next (err)
//    next(null, instance)
//  })
//}

//ResourceSchema.methods.patch = function(input, next){
//  next||(next=function(){})
//  this.update(input, function(error,result){
//    next(error,result)
//  })
//}
