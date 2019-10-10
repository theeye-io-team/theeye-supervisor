const BaseSchema = require('./schema')

const ScraperSchema = new BaseSchema({
  timeout: { type: Number },
})

module.exports = ScraperSchema
