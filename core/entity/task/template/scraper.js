'use strict'

const BaseSchema = require('./schema')

const Schema = new BaseSchema({
  url: { type: String, required: true },
  method: { type: String, required: true },
  body: { type: String },
  parser: { type: String },
  pattern: { type: String },
  timeout: { type: Number },
  status_code: { type: Number },
  gzip: { type: Boolean },
  json: { type: Boolean },
})

module.exports = Schema
