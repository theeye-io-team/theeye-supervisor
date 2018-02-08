"use strict"

const BaseSchema = require('./schema')

const ScriptSchema = new BaseSchema({
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: [ String ],
  script: { type: Object }, // embedded not reference
})

module.exports = ScriptSchema
