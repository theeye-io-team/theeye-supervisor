'use strict'

const util = require('util')
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const lifecycle = require('mongoose-lifecycle')
const FetchBy = require('../lib/fetch-by');
const baseProperties = require('./base-schema-properties')

function BaseSchema (props, specs) {
  // Schema constructor
  Schema.call(this, Object.assign({}, baseProperties, props), {
    collection: specs.collection,
    discriminatorKey: '_type'
  })

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

  this.plugin(lifecycle)

  this.statics.fetchBy = function (filter, next) {
    return FetchBy.call(this, filter, next)
  }

  // turn into a new document
  this.methods.mutateNew = function () {
    this._id = mongoose.Types.ObjectId()
    this.isNew = true
    return this
  }

  this.pre('save', function(next) {
    this.last_update = new Date()
    // do stuff
    next()
  })

  this.methods.serialize = function (options = {}) {
    let serial
    if (options?.mode === 'deep') {
      serial = this.toObject() // as is
    } else {
      serial = this.templateProperties() // shallow mode
    }

    serial.source_model_id = this._id
    return serial
  }

  this.methods.templateProperties = function () {
    const values = this.toObject()
    delete values.public
    delete values.user
    delete values.user_id
    delete values.id
    delete values.creation_date
    delete values.last_update
    delete values.customer
    delete values.customer_id
    return values
  }

  return this
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
