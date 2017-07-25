"use strict"

const ObjectId = require('mongoose').Types.ObjectId
const AppRoot = __dirname + '/../../../core'
const lodash = require('lodash')
//const debug = require('debug')('eye:deploy:cleanup_events')
const Workspace = require(AppRoot + '/workspace')

Workspace((err,App) => {
  App.Task.find({
    //_id: ObjectId('5814bf1ce490ae1200a24674') 
  }, (err,tasks) => {
    var done = lodash.after(tasks.length, () => {
      console.log('done');
      process.exit()
    })
    tasks.forEach(task => {
      let id = ObjectId(task.customer_id)
      task.customer = id
      task.save((err, result) => {
        if (err) {
          console.error('ERROR')
          console.error(task)
          console.error(err)
        } else {
          //console.log(result.customer)
          console.log(`task ${task._id} updated`)
        }
        done()
      })
    })
  })
})
