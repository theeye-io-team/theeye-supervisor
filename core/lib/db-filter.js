"use strict"


module.exports = function(input, defaults){
  var filter = {}

  defaults || (defaults={})

  filter.where = Object.assign({}, (defaults.where||{}), (input.where||{}))
  filter.limit = parseInt(input.limit) || null
  filter.sort = Object.assign({}, (defaults.sort||{}), (input.sort||{}))
  filter.include = Object.assign({}, (defaults.include||{}), (input.include||{}))

  if (input.populate) {
    filter.populate = input.populate
  }

  return filter 
}
