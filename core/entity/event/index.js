
const mongodb = require('../../lib/mongodb').db

const BaseSchema = require('./schema')
const TaskEventSchema = require('./task')
const MonitorEventSchema = require('./monitor')
const WebhookEventSchema = require('./webhook')

// default Event does not have a default Emitter
const Event = mongodb.model('Event', new BaseSchema())
const TaskEvent = Event.discriminator('TaskEvent', TaskEventSchema)
const MonitorEvent = Event.discriminator('MonitorEvent', MonitorEventSchema)
const WebhookEvent = Event.discriminator('WebhookEvent', WebhookEventSchema)

Event.ensureIndexes()
exports.Event = Event
exports.TaskEvent = TaskEvent
exports.MonitorEvent = MonitorEvent
exports.WebhookEvent = WebhookEvent
