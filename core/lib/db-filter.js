"use strict"

const assign = require('lodash/assign')

module.exports = function(input, defaults){
  var filter = {}

  defaults||(defaults={})

  filter.where = assign({}, (defaults.where||{}), (input.where||{}))
  filter.limit = parseInt(input.limit) || null
  filter.sort = assign({}, (defaults.sort||{}), (input.sort||{}))
  filter.include = assign({}, (defaults.include||{}), (input.include||{}))

  if (input.populate) filter.populate = input.populate

  return filter 
}
