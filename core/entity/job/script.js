const BaseSchema = require('./schema')

const ScriptSchema = new BaseSchema({
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: [ String ],
  script: { type: Object }, // embedded not reference
  env: { type: Object, default: () => { return {} }},
})

module.exports = ScriptSchema
