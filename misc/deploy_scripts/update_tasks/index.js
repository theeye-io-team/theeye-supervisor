"use strict"

const ObjectId = require('mongoose').Schema.Types.ObjectId
const AppRoot = __dirname + '/../../../core'
const lodash = require('lodash')
//const debug = require('debug')('eye:deploy:cleanup_events')
const Workspace = require(AppRoot + '/workspace')

Workspace((err,App) => {
  App.Task.find({}, (err,tasks) => {
    var done = lodash.after(tasks.length, () => {
      console.log('done');
      process.exit()
    })
    tasks.forEach(task => {
      task.customer = ObjectId(task.customer_id)
      task.save(() => {
        if (err) {
          console.error('ERROR')
          console.error(task)
          console.error(err)
        } else {
          console.log('task updated');
        }
        done()
      })
    })
  })
})
