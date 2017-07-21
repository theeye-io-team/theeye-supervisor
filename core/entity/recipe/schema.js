'use strict'

const BaseSchema = require('../base-schema')
const properties = require('./properties')
const util = require('util')

function ReceiptSchema () {
  BaseSchema.call(this, properties, {
    collection: 'receipts'
  })
  
  return this
}

util.inherits(ReceiptSchema, BaseSchema)

module.exports = ReceiptSchema
