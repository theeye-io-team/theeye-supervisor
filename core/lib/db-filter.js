module.exports = (query = {}, defaults = {}) => {
  const filter = {}
  filter.where = Object.assign({}, (defaults.where||{}), (query.where||{}))
  filter.sort = Object.assign({}, (defaults.sort||{}), (query.sort||{}))
  filter.include = Object.assign({}, (defaults.include||{}), (query.include||{}))
  filter.limit = parseInt(query.limit) || null

  if (query.populate) { filter.populate = query.populate }

  return filter 
}
