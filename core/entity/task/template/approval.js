'use strict'

const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const Schema = new BaseSchema({
  approvers: [{ type : ObjectId, ref: 'User' }],
  //approver: { type: ObjectId }
})

module.exports = Schema
