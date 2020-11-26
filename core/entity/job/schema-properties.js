const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;

module.exports = {
  task_id: { type: String },
  task: { type: ObjectId, ref: 'Task' }, // embedded
  workflow_id: { type: String }, // job belongs to a specific workflow
  workflow: { type: ObjectId, ref: 'Workflow' },
  workflow_job_id: { type: String }, // job belongs to an instance of the workflow
  workflow_job: { type: ObjectId, ref: 'WorkflowJob' },
  host_id: { type: String },
  host: { type: ObjectId, ref: 'Host' },
  user_id: { type: String },
  customer: { type: ObjectId, ref: 'Customer' },
  customer_id: { type: String },
  customer_name: { type: String },
  name: { type: String },
  notify: { type: Boolean },
  state: { type: String }, // job state
  lifecycle: { type: String },
  //task_arguments_values: [ String ], // array of task arguments
  task_arguments_values: [ ], // array of task arguments
  result: {
    type: Object,
    default: () => { return {} }
  },
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
  },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  trigger_name: { type: String }, // final state success or failure. always success by default
  //event: { type: ObjectId, ref: 'Event' }, // last workflow event
  //event_id: { type: ObjectId },
  //event_data: { type: Object, default: () => { return {} } },
  origin: { type: String }
}
