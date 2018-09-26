const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const ApprovalSchema = new BaseSchema({
  approvers: [{ type : ObjectId, ref: 'User' }],
  template_id: { type: ObjectId },
  //approver: { type: ObjectId, ref: 'User' },
  template: { type: ObjectId, ref: 'ApprovalTaskTemplate' },
  type: { type: String, default: 'approval' },
})

module.exports = ApprovalSchema
