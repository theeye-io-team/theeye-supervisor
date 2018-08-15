const BaseSchema = require('../base-schema')
const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;

const props = {
  workflow_id: { type: String }, // job belongs to a specific workflow
  workflow: { type: ObjectId, ref: 'Workflow' },
  user_id: { type: String },
  user: { type: ObjectId, ref: 'User' },
  customer_id: { type: String },
  customer_name: { type: String },
  name: { type: String },
  notify: { type: Boolean },
  state: { type: String, default: 'unknown' }, // job reported state
  lifecycle: { type: String },
  trigger_name: { type: String }, // final state success or failure. always success by default
  origin: { type: String },
  result: { type: Object, default: () => { return {} } },
  output: {
    type: String,
    get: function (data) {
      if (!data) { return null }
      try { 
        return JSON.parse(data)
      } catch (e) { 
        return [ e.message ]
      }
    },
    set: function (data) {
      try {
        return JSON.stringify(data)
      } catch (e) {
        let err = [ e.message ]
        return JSON.stringify(err)
      }
    },
    default: () => { return [] }
  }
}

const ScriptSchema = new BaseSchema(props, { collection: 'jobs' })

module.exports = ScriptSchema
