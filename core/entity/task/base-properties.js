const ObjectId = require('mongoose').Types.ObjectId
const randomSecret = require('../../lib/random-secret')
const StateConstants = require('../../constants/states')

module.exports = {
  order: { type: Number, default: 0 },
  customer_id: { type: String, required: true },
  type: { type: String, required: true },
  name: { type: String, required: true },
  customer: { type: ObjectId, ref: 'Customer' },
  public: { type: Boolean, default: false },
  tags: { type: Array },
  description : { type: String },
  short_description : { type: String },
  icon_color: { type: String },
  icon_image: { type: String },
  triggers: [{ type: ObjectId, ref: 'Event' }],
  secret: { type: String, default: randomSecret }, // one way hash
  grace_time: { type: Number, default: 0 },
  timeout: { type: Number },
  task_arguments: { type: Array }, // input parameters
  arguments_type: { type: String, default: 'legacy' },
  output_parameters: { type: Array }, // output parameters
  workflow_id: { type: ObjectId },
  workflow: { type: ObjectId, ref: 'Workflow' },
  register_body: { type: Boolean, default: false },
  execution_count: { type: Number, default: 0 },
  multitasking: { type: Boolean, default: true },
  show_result: { type: Boolean, default: false }, // popup

  // send activity to the logger system
  logger: { type: Boolean },
  // send activity to the notification system
  notify: { type: Boolean },

  // users that will interact with this task
  assigned_users: [{ type: String }],
  // this task requieres input (forced). will not accept input via triggers. users action is required.
  user_inputs: { type: Boolean, default: false },
  // which users members are going to interact with the workflow execution. keep it for backward compatibility.
  user_inputs_members: [{ type: String }],
  // user access control list. who can execute, observe, interact with the task and the jobs
  acl: [{ type: String }],

  // jobs behaviour can change during run time
  allows_dynamic_settings: { type: Boolean },

  // Apply to the jobs created from this task,
  // will be only visible to the user/owner and the assigned_users.
  // if "true" acl will be empty on creation
  empty_viewers: { type: Boolean, default: false },

  // can be canceled by users
  cancellable: { type: Boolean, 'default': true },
  autoremove_completed_jobs: { type: Boolean },
  autoremove_completed_jobs_limit: { type: Number, 'default': 5 },
  version: { type: Number, 'default': 1 },
  fingerprint: { type: String, 'default': '' }, 
  default_state_evaluation: { type: String, 'default': StateConstants.SUCCESS },
  stack_scheduled_executions: { type: Boolean, "default": false }
  //handle_errors: { type: Boolean }
}
