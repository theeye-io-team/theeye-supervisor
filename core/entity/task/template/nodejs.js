const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId
const BaseSchema = require('./schema') // template schema

const Schema = new BaseSchema({
  script: { type: ObjectId, ref: 'ScriptTemplate' }, // has one
  script_id: { type: ObjectId },
  script_path: { type: String },
  script_runas: { type: String, default: 'node' },
  env: { type: Object, default: () => { return {} }},
})

module.exports = Schema

