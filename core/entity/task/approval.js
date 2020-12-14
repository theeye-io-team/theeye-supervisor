const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const ApprovalSchema = new BaseSchema({
  success_label: { type: String },
  failure_label: { type: String },
  cancel_label: { type: String },
  ignore_label: { type: String },
  approvers: [{ type: ObjectId }],
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'ApprovalTaskTemplate' },
  type: { type: String, default: 'approval' },
})

module.exports = ApprovalSchema
