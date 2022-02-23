const util = require('util')
const BaseSchema = require('../base-schema')
const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId
const logger = require('../../lib/logger')('entity:workflow:schema')
const randomSecret = require('../../lib/random-secret')

function WorkflowSchema (props) {
  props || (props={})

  const specs = { collection: 'workflows' }
  const properties = {
    order: { type: Number, default: 0 },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    tags: { type: Array, default: [] },
    triggers: [{ type: ObjectId, ref: 'Event' }],
    graph: { type: Object },
    lifecycle: { type: String },
    state: { type: String },
    current_task_id: { type: ObjectId }, // current task being executed
    current_task: { type: ObjectId, ref: 'Task' },
    start_task_id: { type: ObjectId },
    start_task: { type: ObjectId, ref: 'Task' },
    end_task_id: { type: ObjectId, required: false },
    end_task: { type: ObjectId, ref: 'Task', required: false },
    secret: { type: String, default: randomSecret }, // one way hash
    table_view: { type: Boolean, default: false },

    // send activity to the logger system
    logger: { type: Boolean },
    // send activity to the notification system
    notify: { type: Boolean },

    // users that will interact with this workflows
    assigned_users: [{ type: String }],
    // which users members are going to interact with this workflow execution
    // keep it backward compatible.
    user_inputs_members: [{ type: String }],
    // user access control list. who can execute, observe, interact with the workflow and the jobs
    acl: [{ type: String }],
    // Apply to the workflow-jobs created from this workflow, and the task jobs that belongs to the workflow-jobs,
    // will be only visible to the user/owner and the assigned_users.
    // if "true" acl will be empty on creation
    empty_viewers: { type: Boolean, default: false },

    // jobs behaviour can change during run time
    allows_dynamic_settings: { type: Boolean },

    // @TODO REMOVE
    acl_dynamic: { type: Boolean, default: false },

    // default schema type
    _type: {
      type: String,
      default: 'Workflow'
    },
    autoremove_completed_jobs: { type: Boolean },
    autoremove_completed_jobs_limit: { type: Number, 'default': 5 },
  }

  BaseSchema.call(this, Object.assign({}, properties, props), specs)

  //this.methods.populateTriggers = _populateTriggers

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

  return this
}

util.inherits(WorkflowSchema, BaseSchema)

module.exports = WorkflowSchema

//function _populateTriggers (done) {
//  this.populate('triggers',(err) => {
//    if (err) return done(err)
//    if (Array.isArray(this.triggers) && this.triggers.length > 0) {
//      const populated = after(this.triggers.length, done)
//      this.triggers.forEach((event) => {
//        if (!event) {
//          // empty elements could be present inside triggers
//          return populated()
//        }
//
//        event.populate({
//          path: 'emitter',
//          populate: {
//            path: 'host',
//            model: 'Host'
//          }
//        },(err) => {
//          if (err) {
//            logger.error('could not populate event %o', event)
//            logger.error(err)
//          }
//          populated()
//        })
//      })
//    } else {
//      done()
//    }
//  })
//}
