"use strict"

const BaseSchema = require('../schema')

const NgrokSchema = new BaseSchema({
  address: { type: String },
  protocol: { type: String },
  authtoken: { type: String },
  operation: { type: String }
})

module.exports = NgrokSchema
