const BaseSchema = require('./schema')

const ScriptSchema = new BaseSchema({
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: [ String ],
  script: { type: Object }, // this is embedded, not a reference
  env: { type: Object, default: () => { return {} }},
  timeout: { type: Number },
  logging: { type: Boolean, default: false }
})

module.exports = ScriptSchema
