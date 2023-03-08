'use strict'

const mongodb = require('../../lib/mongodb').db
const RecipeSchema = require('./schema')

const Recipe = mongodb.model('Recipe', new RecipeSchema())

// called for both inserts and updates
Recipe.on('afterSave', function(model) {
  model.last_update = new Date()
  // do more stuff
})

//Recipe.on('afterInsert',function(model){ })
//Recipe.on('afterUpdate',function(model){ })
//Recipe.on('afterRemove',function(model){ })

exports.Recipe = Recipe
