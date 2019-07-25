"use strict";

const util = require('util');
const Schema = require('mongoose').Schema;
const FetchBy = require('../../lib/fetch-by');
const baseProperties = require('./schema-properties.js')

function BaseSchema (props) {

  // Schema constructor
  Schema.call(this, Object.assign({}, baseProperties, props), {
    collection: 'jobs',
    discriminatorKey: '_type'
  })

  this.statics.fetchBy = function (filter, next) {
    FetchBy.call(this,filter,next)
  }

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

  this.set('toJSON', def)
  this.set('toObject', def)

  /*
   * @return {Boolean}
   */
  this.methods.isIntegrationJob = function () {
    return ( /IntegrationJob/.test(this._type) === true )
  }

  this.methods.publish = function (scope) {
    let data = this.toObject()

    if (scope !== 'agent') {
      delete data.script
      delete data.script_arguments

      if (data.task && typeof data.task === 'object') {
        let dtask = {}
        let id = data.task._id || data.task.id
        dtask.id = id.toString()
        dtask._type = data.task._type
        dtask.type = data.task.type
        dtask.approvers = data.task.approvers
        dtask.task_arguments = data.task.task_arguments
        dtask.output_parameters = data.task.output_parameters
        data.task = dtask
      }
    }

    if (data.task && typeof data.task === 'object') {
      data.timeout = data.task.timeout
      data.env = data.task.env
    }

    if (data.customer && typeof data.customer === 'object') {
      delete data.customer
    }

    if (data.user && typeof data.user === 'object') {
      let user = data.user
      let id = data.user._id || data.user.id
      data.user = {
        id: id.toString(),
        username: user.username,
        email: user.email
      }
    }

    return data
  }

  this.pre('save', function(next) {
    this.last_update = new Date()
    // do stuff
    next()
  })

  return this;
}

util.inherits(BaseSchema, Schema);

module.exports = BaseSchema;
