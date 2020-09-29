const mongodb = require('../../lib/mongodb').db
const MonitorSchema = require('./base')

const Monitor = mongodb.model('ResourceMonitor', MonitorSchema)
Monitor.ensureIndexes()

exports.Monitor = Monitor
exports.Entity = Monitor
