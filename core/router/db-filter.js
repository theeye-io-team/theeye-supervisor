const dbFilter = require('../lib/db-filter')
const { ForbiddenError } = require('../lib/error-handler')

module.exports = (options) => {
  return (req, res, next) => {
    try {
      const customer = req.customer
      const query = req.query
      const filter = dbFilter(query)
      filter.where.customer_id = customer.id

      if (!req.permissions) {
        throw new ForbiddenError()
      }

      const acl = req.permissions.map(p => p.value)
      filter.where.acl = { $in: acl }
      req.dbQuery = filter
      return next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
