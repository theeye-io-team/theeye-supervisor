'use strict'
const ObjectId = require('mongoose').Schema.Types.ObjectId
const randomSecret = require('../../lib/random-secret')
module.exports = {
  order: { type: Number, default: 0 },
  customer_id: { type: String, required: true },
  type: { type: String, required: true },
  name: { type: String, required: true },
  customer: { type: ObjectId, ref: 'Customer' },
  public: { type: Boolean, default: false },
  tags: { type: Array },
  description : { type: String },
  triggers: [{ type: ObjectId, ref: 'Event' }],
  acl: [{ type: String }],
  secret: { type: String, default: randomSecret }, // one way hash
  grace_time: { type: Number, default: 0 },
  timeout: { type: Number },
  task_arguments: { type: Array }, // input parameters
  output_parameters: { type: Array }, // output parameters
  workflow_id: { type: ObjectId },
  workflow: { type: ObjectId, ref: 'Workflow' },
  register_body: { type: Boolean, default: false },
  execution_count: { type: Number, default: 0 },
  multitasking: { type: Boolean, default: true },
  user_inputs: { type: Boolean, default: false },
  user_inputs_members: [{ type: String }],
  show_result: { type: Boolean, default: false }
}
