
const m2s = require('mongoose-to-swagger');
const mongodb = require('../../lib/mongodb').db
const RecipeSchema = require('./schema')

const Recipe = mongodb.model('Recipe', new RecipeSchema())
Recipe.ensureIndexes()

// called for both inserts and updates
Recipe.on('afterSave', function(model) {
  model.last_update = new Date()
  // do more stuff
})

exports.Recipe = Recipe

exports.swagger = {
  components: {
    schemas: {
      Recipe: m2s(Recipe)
    }
  }
}
