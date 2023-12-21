const BaseSchema = require('./schema')
const ScriptSchema = require('./script')

const NodejsSchema = new BaseSchema(
  Object.assign({}, ScriptSchema.obj, {
    type: { type: String, default: 'nodejs' },
    script_runas: { type: String, default: 'node' }
  })
)

module.exports = NodejsSchema
