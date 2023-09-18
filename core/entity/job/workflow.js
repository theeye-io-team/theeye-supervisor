const BaseSchema = require('../base-schema')
const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;
//const randomSecret = require('../../lib/random-secret')

const props = {
  order: { type: Number, default: 0 },
  customer_id: { type: String },
  customer_name: { type: String },
  name: { type: String },
  // job reported state
  state: { type: String, default: 'unknown' },
  lifecycle: { type: String },
  // final state success or failure. always success by default
  trigger_name: { type: String },
  triggered_by: { type: ObjectId, ref: 'Event' },
  origin: { type: String },
  // job belongs to a specific workflow
  workflow_id: { type: String },
  workflow: { type: ObjectId, ref: 'Workflow' },
  result_id: { type: ObjectId, ref: 'File' },
  notify: { type: Boolean },
  // users that will interact with this workflows
  assigned_users: [{ type: String }],
  // job user owner and interaction
  user_id: { type: String },
  // which users members are going to interact with the workflow execution. keep it for backward compatibility.
  user_inputs_members: [{ type: String }],
  // user access control list. who can execute and view the workflows and the jobs
  acl: [{ type: String }],
  // jobs behaviour can change during run time
  allows_dynamic_settings: { type: Boolean },
  // the workflow-jobs created from this workflow,
  // and all the task jobs that belongs to the workflow-jobs,
  // will only be visible to assigned users.
  // if "true" job acl will be empty on creation
  empty_viewers: { type: Boolean, default: false }, // if "true" acl will be empty on creation
  //
  //
  // @TODO REMOVE HEREUNDER PROPERTIES
  //
  //
  acl_dynamic: { type: Boolean, default: false },

  //result_id: { type: ObjectId, ref: 'File' },
  //output: {
  //  type: String,
  //  get: function (data) {
  //    if (!data) { return null }
  //    try {
  //      return JSON.parse(data)
  //    } catch (e) {
  //      return [ e.message ]
  //    }
  //  },
  //  set: function (data) {
  //    try {
  //      return JSON.stringify(data)
  //    } catch (e) {
  //      let err = [ e.message ]
  //      return JSON.stringify(err)
  //    }
  //  },
  //  default: () => { return [] }
  //}
}

module.exports = new BaseSchema(props, { collection: 'jobs' })
