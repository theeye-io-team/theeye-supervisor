//const logger = require('../lib/logger')('router:db-filter')
const dbFilter = require('../lib/db-filter')
const { ForbiddenError, ServerError } = require('../lib/error-handler')
const EscapedRegExp = require('../lib/escaped-regexp')

module.exports = function (options) {
  return (req, res, next) => {
    try {
      const customer = req.customer
      const query = req.query
      const filter = dbFilter(query)
      filter.where.customer_id = customer.id

      if (!req.hasOwnProperty('permissions')) {
        const reqp = req._url?.pathname
        const msg =`Missing ensure-permissions middleware before fetch invocation in req path: ${reqp}`
        throw new ServerError(msg)
      }

      if (req.permissions !== true) {
        if (!Array.isArray(req.permissions)) {
          throw new ServerError('Bad permissions definition')
        }

        if (!req.permissions.length === 0) {
          throw new ForbiddenError()
        }

        const acl = req.permissions
          .map(p => new EscapedRegExp(`${p.value}`,'i'))
        filter.where.acl = { $in: acl }
      }

      req.dbQuery = filter
      return next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
