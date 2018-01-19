'use strict'

const BaseSchema = require('../base-schema')
const properties = require('./properties')
const util = require('util')

function RecipeSchema () {
  BaseSchema.call(this, properties, {
    collection: 'recipe'
  })
  
  return this
}

util.inherits(RecipeSchema, BaseSchema)

module.exports = RecipeSchema
