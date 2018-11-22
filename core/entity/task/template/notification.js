'use strict'

const BaseSchema = require('./schema')

const Schema = new BaseSchema({
  subject: { type: String, required: true },
  body: { type: String },
  notificationTypes: {
    type: Object,
    default: () => {
      return {
        push: true,
        email: false,
        socket: false,
        desktop: false
      }
    }
  },
  recipients: [{ type: String }]
})

module.exports = Schema
