"use strict";

const lodash = require('lodash')
//const debug = require('debug')('eye:deploy:cleanup_events')
const Workspace = require('../../../workspace/app')

Workspace((err, App) => {

  App.Event.fetch({ }, (err,events) => {
    var done = lodash.after(events.length, () => {
      console.log('done');
      process.exit()
    })
    events.forEach( e => {
      if (!e.emitter) {
        e.remove(() => {
          console.log('event without emitter removed')
          done()
        })
      } else {
        e.emitter_id = e.emitter
        e.customer_id = e.customer
        e.save((err) => {
          console.log('event data updated')
          done()
        })
      }
    })
  })

})
