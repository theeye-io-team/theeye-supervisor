'use strict'

const Schema = require('mongoose').Schema
const ObjectId = Schema.Types.ObjectId

const Instructions = new Schema({
  resources: [{}], // should be an array of resources/monitors
  tasks: [{}], // should be an array of tasks
  triggers: [{}], // this is an array of events linked to emitter entities
  files: [{}]
})

module.exports = {
  name: { type: String },
  description : { type: String },
  public: { type: Boolean, default: false },
  tags: { type: Array },
  instructions: { type: Instructions },
  hostgroup_id: { type: ObjectId },
  hostgroup: { type: ObjectId, ref: 'HostGroup'},
}
