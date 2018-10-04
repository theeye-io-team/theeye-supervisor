'use strict'

const util = require('util')
const after = require('lodash/after')
const logger = require('../../lib/logger')('entity:task:schema')
const BaseSchema = require('../base-schema')
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
    delete values.id
    delete values.host
    delete values.host_id
    delete values.secret
    delete values.user
    delete values.user_id
    delete values.acl
    delete values.customer
    delete values.customer_id
    delete values.workflow
    delete values.workflow_id
    return values
  }

  this.methods.populateTriggers = function (done) {
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

  return this
}

util.inherits(TaskSchema, BaseSchema)

module.exports = TaskSchema
