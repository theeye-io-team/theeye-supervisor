const m2s = require('mongoose-to-swagger');
const mongodb = require('../../lib/mongodb').db
const MonitorSchema = require('./base')

const Monitor = mongodb.model('ResourceMonitor', MonitorSchema)
Monitor.ensureIndexes()

exports.Monitor = Monitor
exports.Entity = Monitor

exports.swagger = {
  components: {
    schemas: {
      Monitor: m2s(Monitor)
    }
  }
}
