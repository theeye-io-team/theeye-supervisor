const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const ApprovalSchema = new BaseSchema({
  approvers: [{ type: ObjectId }],
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'ApprovalTaskTemplate' },
  type: { type: String, default: 'approval' },
})

module.exports = ApprovalSchema
