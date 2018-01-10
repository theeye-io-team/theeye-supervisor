"use strict"

const extend = require('util')._extend

module.exports = function(input, defaults){
  var filter = {}

  defaults||(defaults={})

  filter.where = extend({}, (defaults.where||{}), (input.where||{}))
  filter.limit = parseInt(input.limit) || null
  filter.sort = extend({}, (defaults.sort||{}), (input.sort||{}))
  filter.include = extend({}, (defaults.include||{}), (input.include||{}))

  if (input.populate) filter.populate = input.populate

  return filter 
}
