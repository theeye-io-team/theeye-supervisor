"use strict"

const debug = require('debug')('entity:task')
const Schema = require('mongoose').Schema
const after = require('lodash/after')
const async = require('async')
const logger = require('../../lib/logger')('entity:task:schema')
require('mongoose-schema-extend')

const BaseSchema = require('../base-schema')
const properties = require('./base-properties')

//exports.properties = properties

var EntitySchema = new BaseSchema(properties,{
  collection: 'tasks',
  discriminatorKey: '_type'
})

const def = {
  getters: true,
  virtuals: true,
  transform: function (doc, ret, options) {
    // remove the _id of every document before returning the result
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.secret;
  }
}

EntitySchema.set('toJSON', def)
EntitySchema.set('toObject', def)

EntitySchema.methods.templateProperties = function () {
  const values = {}
  var key
  for (key in properties) {
    values[key] = this[key]
  }
  values.secret = undefined
  values.user_id = undefined
  return values
}

EntitySchema.methods.populateTriggers = function (done) {
  const task = this
  task.populate('triggers',(err) => {
    if (err) return done(err)
    if (Array.isArray(task.triggers) && task.triggers.length > 0) {
      // call after task triggers async populate is completed
      const populated = after(task.triggers.length, done)
      task.triggers.forEach((event) => {
        if (!event) {
          // empty elements could be present inside triggers
          return populated()
        }

        event.populate({
          path: 'emitter',
          populate: {
            path: 'host',
            model: 'Host'
          }
        },(err) => {
          if (err) {
            logger.error('could not populate event %o', event)
            logger.error(err)
          }
          populated()
        })
      })
    } else { // task hasn't got any triggers
      done()
    }
  })
}

module.exports = EntitySchema;
