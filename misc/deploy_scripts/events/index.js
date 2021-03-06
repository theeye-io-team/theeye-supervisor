'use strict'

var appRoot = __dirname + '/../../../core'
var lodash = require('lodash')

require(appRoot + '/lib/mongodb').connect(() => {
  var TM = require(appRoot + '/entity/task')
  require(appRoot + '/entity/task/scraper')

  var Event = require(appRoot + '/entity/event')
  var Monitor = require(appRoot + '/entity/monitor').Entity
  var Task = TM.Entity
  var MonitorService = require(appRoot + '/service/resource')

  var completed = lodash.after(2, () => process.exit(0))

  Monitor.find().exec((err, monitors) => {
    if (err) throw err

    var debug = require('debug')('eye:deploy:monitor-event')

    var next = lodash.after(monitors.length, () => completed())

    monitors.forEach(m => {
      m.populate('resource', err => {
        if (err) {
          debug('error populating monitor %j', m.toObject())
          debug(err)
        }

        if (!m.resource) {
          debug('ERROR monitor resource cannot be found %j', m.toObject())
          return next()
        }

        debug('creating monitor event %s/%s', m._id, m.name)
        MonitorService.createDefaultEvents(
          m,
          m.resource.customer_id,
          err => {
            if (err) debug(err)
            else debug('CREATED monitor event %s/%s', m._id, m.name)
            next()
          }
        )
      })
    })
  })

  Task.find().exec((err, tasks) => {
    if (err) throw err

    var debug = require('debug')('eye:deploy:task-event')

    var next = lodash.after(tasks.length, () => completed())

    tasks.forEach(t => {
      debug('creating task event %s/%s', t._id, t.name)

      var event = new Event.TaskEvent({
        customer: t.customer_id,
        emitter: t._id,
        emitter_id: t._id,
        name: 'success'
      })
      event.save(err => {
        if (err) debug(err)
        else debug('CREATED task event %s/%s', t._id, t.name)

        var event = new Event.TaskEvent({
          customer: t.customer_id,
          emitter: t._id,
          emitter_id: t._id,
          name: 'failure'
        })
        event.save(err => {
          if (err) debug(err)
          else debug('CREATED task event %s/%s', t._id, t.name)

          next()
        })
      })
    })
  })
})
