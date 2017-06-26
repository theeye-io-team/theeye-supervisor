"use strict";

const AppRoot = __dirname + '/../../../core'
//const lodash = require('lodash')
//const debug = require('debug')('eye:deploy:cleanup_events')
const Workspace = require(AppRoot + '/workspace')

Workspace( (err,App) => {

  App.Event.fetch({ }, (err,events) => {
    events.forEach( e => {
      if (!e.emitter) {
        console.log('removing event without emitter')
        e.remove()
      }
    })
    console.log('done.')
    process.exit(0)
  })

})
