const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const ApprovalSchema = new BaseSchema({
  success_label: { type: String },
  failure_label: { type: String },
  cancel_label: { type: String },
  ignore_label: { type: String },
  success_enabled: { type: Boolean, 'default': true },
  failure_enabled: { type: Boolean, 'default': true },
  cancel_enabled: { type: Boolean, 'default': true },
  ignore_enabled: { type: Boolean, 'default': true },
  approvals_target: { type: String }, // who approves
  approvers: [{ type: ObjectId }], // if approval_assignee is "members" , "approvers" must be a list of users/members
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'ApprovalTaskTemplate' },
  type: { type: String, default: 'approval' },
})

module.exports = ApprovalSchema
