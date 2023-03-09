'use strict'

const mongodb = require('../../lib/mongodb').db
const RecipeSchema = require('./schema')

const Recipe = mongodb.model('Recipe', new RecipeSchema())

exports.Recipe = Recipe
