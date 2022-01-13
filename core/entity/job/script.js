const BaseSchema = require('./schema')

const ScriptSchema = new BaseSchema({
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: [ String ],
  script: { type: Object }, // this is embedded, not a reference
  env: { type: Object, default: () => { return {} }},
  timeout: { type: Number },
  execution_logging_enabled: { type: Boolean, default: false },
  execution_logging_basename: { type: String, default: null },
  execution_logging_dirname: { type: String, default: null },
})

module.exports = ScriptSchema
