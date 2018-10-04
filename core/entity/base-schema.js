'use strict'

const util = require('util')
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const lifecicle = require('mongoose-lifecycle')
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

  this.plugin(lifecicle)

  this.statics.fetchBy = function (filter, next) {
    FetchBy.call(this,filter,next)
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

  return this
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
