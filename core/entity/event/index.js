
const mongodb = require('../../lib/mongodb').db

const BaseSchema = require('./schema')
const IndicatorEventSchema = require('./indicator')
const TaskEventSchema = require('./task')
const MonitorEventSchema = require('./monitor')
const WebhookEventSchema = require('./webhook')
const WorkflowEventSchema = require('./workflow')

// default Event does not have a default Emitter
const Event = mongodb.model('Event', new BaseSchema())
const TaskEvent = Event.discriminator('TaskEvent', TaskEventSchema)
const IndicatorEvent = Event.discriminator('IndicatorEvent', IndicatorEventSchema)
const MonitorEvent = Event.discriminator('MonitorEvent', MonitorEventSchema)
const WebhookEvent = Event.discriminator('WebhookEvent', WebhookEventSchema)
const WorkflowEvent = Event.discriminator('WorkflowEvent', WorkflowEventSchema)

exports.Event = Event
exports.TaskEvent = TaskEvent
exports.MonitorEvent = MonitorEvent
exports.WebhookEvent = WebhookEvent
exports.WorkflowEvent = WorkflowEvent
exports.IndicatorEvent = IndicatorEvent
