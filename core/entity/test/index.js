const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId
const apiFetch = require('../api-fetch')
const db = require('../../lib/mongodb').db
const BaseSchema = require('../base-schema')

module.exports = function () {
  const Test = db.model('Test', new Schema())

  const TaskTest = Test.discriminator(
    'TaskTest',
    new Schema({
      task_id: ObjectId,
      task: { type: ObjectId, ref: 'Task' },
    })
  )

  const WorkflowTest = Test.discriminator(
    'WorkflowTest',
    new Schema({
      workflow_id: { type: ObjectId },
      workflow: { type: ObjectId, ref: 'Workflow' },
    })
  )

  return { Test, TaskTest, WorkflowTest }
}

function Schema (props = {}) {
  const schema = new BaseSchema(
    Object.assign({
      order: { type: Number, default: 0 },
      name: { type: String, required: true },
      tags: { type: Array },
      description : { type: String },
      task_arguments: { type: Array }, // input parameters
      task_outputs: { type: Array }, // output parameters
      customer: { type: ObjectId, ref: 'Customer' },
      customer_id: { type: String, required: true },
      creation_date: { type: Date, default: () => { return new Date() }, required: true },
      last_update: { type: Date, default: () => { return new Date() }, required: true }
    }, props), {
      collection: 'tests',
      discriminatorKey: '_type'
    }
  )

  schema.statics.apiFetch = apiFetch

  return schema
}
