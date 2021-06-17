const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const Schema = new BaseSchema({
  success_label: { type: String },
  failure_label: { type: String },
  cancel_label: { type: String },
  ignore_label: { type: String },
  approvals_target: { type: String },
  approvers: [{ type: ObjectId }]
})

module.exports = Schema
