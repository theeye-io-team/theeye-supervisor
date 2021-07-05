const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;

module.exports = {
  order: { type: Number, default: 0 },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  customer_id: { type: String },
  customer: { type: ObjectId, ref: 'Customer' },
  customer_name: { type: String },
  name: { type: String },
  state: { type: String }, // job state
  lifecycle: { type: String },
  trigger_name: { type: String }, // final event. succes/failure by default
  triggered_by: { type: ObjectId, ref: 'Event' },
  origin: { type: String },
  workflow_id: { type: String }, // job belongs to a specific workflow
  workflow: { type: ObjectId, ref: 'Workflow' },
  workflow_job_id: { type: String }, // job belongs to an instance of the workflow
  workflow_job: { type: ObjectId, ref: 'WorkflowJob' },
  result: { type: Object, default: () => { return {} } },
  output: {
    type: String,
    get: function (data) {
      if (!data) { return null }
      try { 
        return JSON.parse(data)
      } catch (e) { 
        return [ e.message ]
      }
    },
    set: function (data) {
      try {
        return JSON.stringify(data)
      } catch (e) {
        let err = [ e.message ]
        return JSON.stringify(err)
      }
    },
    default: () => { return [] }
  },
  host_id: { type: String },
  host: { type: ObjectId, ref: 'Host' },
  task_id: { type: String },
  task: { type: Object }, // embedded
  //task_arguments_values: [ String ], // array of task arguments
  task_arguments_values: [ ], // array of task arguments
  notify: { type: Boolean },
  show_result: { type: Boolean, default: false }, // popup

  // users that will interact with this workflows
  assigned_users: [{ type: String }],
  // job user owner and default interaction
  user_id: { type: String }, // created by and default owner
  // this task requieres input (forced). will not accept input via triggers. users action is required.
  user_inputs: { type: Boolean, default: false },
  // which users members are going to interact with the workflow execution. keep it for backward compatibility.
  user_inputs_members: [{ type: String }],
  // user access control list. who can execute and view the workflows and the jobs
  acl: [{ type: String }],

  // jobs behaviour can change during run time
  allows_dynamic_settings: { type: Boolean },

  // will be only visible to the user/owner and the assigned_users.
  // if "true" acl will be empty on creation
  empty_viewers: { type: Boolean, default: false },

  // can be canceled by users
  cancellable: { type: Boolean, 'default': true },
}
