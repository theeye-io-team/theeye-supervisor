const BaseSchema = require('./schema')

const ScraperSchema = new BaseSchema({
  timeout: { type: Number },
  register_body: { type: Boolean }
})

module.exports = ScraperSchema
