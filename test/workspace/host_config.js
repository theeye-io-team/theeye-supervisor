'use strict'
//
// Workspace setup
//
// DEBUG='lib:*,theeye:*' NODE_ENV='localdev' node
//
var Workspace = require('../../core/workspace.js')
const debug = require('debug')('theeye:workspace:test')

module.exports = (done) => {
  Workspace( (err,App) => {
    const Service = require('../../core/service/host')
    debug('fetching host')
    App.Host.findById("58052aca3075b3f25351ab1f").exec((err,host) => {

    debug('fetching customer')
      App.Customer.findById(host.customer_id).exec((err,customer) => {

        debug('building configs')
        Service.config(host,customer,done)

      })
    })
  })
}
