const util = require('util')
const Schema = require('mongoose').Schema
const ObjectId = Schema.Types.ObjectId
const debug = require('debug')('eye:entity:monitor')
const lodashAfter = require('lodash/after')

const properties = {
  looptime: { type: Number },
  name: { type: String },
  type: { type: String },
  config: { type: Object, default: {} },
  tags: { type: Array, default: [] },
  customer_id: { type: ObjectId },
  customer_name: { type: String },
  description: { type: String },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  // RELATIONS
  customer: { type: ObjectId, ref: 'Customer' } // belongs to
}

function BaseSchema (specs, opts) {
  
  // Schema constructor
  Schema.call(this, Object.assign({}, properties, specs), {
    collection: opts.collection,
    discriminatorKey: '_type'
  })

  this.pre('save', function(next) {
    this.last_update = new Date()
    // do stuff
    next()
  })

  // Duplicate the ID field.
  this.virtual('id').get(function () {
    return this._id.toHexString()
  })

  const def = {
    getters: true,
    virtuals: true,
    transform: function (doc, ret, options) {
      // remove the _id of every document before returning the result
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }

  this.set('toJSON', def);
  this.set('toObject', def)

  this.methods.publish = function (options, next) {
    var data = this.toObject()
    if (next) { next(null, data) }
    return data
  }

  this.statics.publishAll = function (entities, next) {
    if (!entities || entities.length == 0) {
      return next([])
    }

    var published = []
    var donePublish = lodashAfter(entities.length, function () {
      next(null, published)
    })

    for (let i = 0; i<entities.length; i++){
      var entity = entities[i];
      entity.publish({}, function(error, data) {
        published.push(data);
        donePublish()
      })
    }
  }

  this.pre('save', function(next) {
    this.last_update = new Date()
    // do stuff
    next()
  })
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
