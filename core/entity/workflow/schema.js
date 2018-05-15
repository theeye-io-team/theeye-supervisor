const util = require('util')
const BaseSchema = require('../base-schema')
const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId
const logger = require('../../lib/logger')('entity:workflow:schema')

function WorkflowSchema (props) {
  props || (props={})

  const specs = { collection: 'workflows' }
  const properties = {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    tags: { type: Array, default: [] },
    acl: [{ type: String }],
    triggers: [{ type: ObjectId, ref: 'Event' }],
    user_id: { type: ObjectId },
    user: { type: ObjectId, ref: 'User' },
    graph: { type: Object },
    first_task_id: { type: ObjectId },
    first_task: { type: ObjectId, ref: 'Task' },
    last_task_id: { type: ObjectId },
    last_task: { type: ObjectId, ref: 'Task' },
    _type: {
      type: String,
      default: 'Workflow'
    }
  }

  BaseSchema.call(this, util._extend({}, properties, props), specs)

  this.methods.populateTriggers = _populateTriggers

  return this
}

util.inherits(WorkflowSchema, BaseSchema)

module.exports = WorkflowSchema

function _populateTriggers (done) {
  this.populate('triggers',(err) => {
    if (err) return done(err)
    if (Array.isArray(this.triggers) && this.triggers.length > 0) {
      const populated = after(this.triggers.length, done)
      this.triggers.forEach((event) => {
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
    } else {
      done()
    }
  })
}
