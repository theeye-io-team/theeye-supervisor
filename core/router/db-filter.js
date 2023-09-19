const dbFilter = require('../lib/db-filter')
const { ForbiddenError, ServerError } = require('../lib/error-handler')
const EscapedRegExp = require('../lib/escaped-regexp')

module.exports = (options) => {
  return (req, res, next) => {
    try {
      const customer = req.customer
      const query = req.query
      const filter = dbFilter(query)
      filter.where.$or = [
        { customer_id: customer.id },
        { customer: customer.id },
      ]

      if (!req.permissions) {
        throw new ForbiddenError()
      }

      if (req.permissions !== true) {
        if (!Array.isArray(req.permissions)) {
          throw new ServerError('Bad permissions definition')
        }
        const acl = req.permissions.map(p => {
          return new EscapedRegExp(`${p.value}`,'i')
        })
        console.log(acl)
        filter.where.acl = { $in: acl }
      }

      req.dbQuery = filter
      return next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
