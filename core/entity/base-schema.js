'use strict'

const util = require('util')
const Schema = require('mongoose').Schema
const lifecicle = require('mongoose-lifecycle')
const FetchBy = require('../lib/fetch-by');
const baseProperties = require('./base-schema-properties')

function BaseSchema (props, specs) {
  // Schema constructor
  Schema.call(this, Object.assign({}, baseProperties, props),{
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
      // remove the _id of every document before returning the result
      ret.id = ret._id
      delete ret._id
      delete ret.__v
    }
  }

  this.set('toJSON'  , def)
  this.set('toObject', def)

  this.plugin(lifecicle)

  /**
   *
   * helper update method
   *
   */
  this.methods.update = function(updates, next){
    var model = this
    var data = model.toObject()
    for (var key in updates) {
      if (data.hasOwnProperty(key)) {
        model[key] = updates[key]
      }
    }
    model.save( err => next(err,model) )
  }

  this.statics.fetchBy = function (filter, next) {
    FetchBy.call(this,filter,next)
  }

  return this
}

util.inherits(BaseSchema, Schema)

module.exports = BaseSchema
