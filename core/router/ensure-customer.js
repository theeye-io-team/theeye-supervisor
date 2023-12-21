const { ClientError } = require('../lib/error-handler')
module.exports = function (req, res, next) {
  try {
    const { customer, user, session } = req

    if (!customer) {
      throw new ClientError('unauthorized. customer required', { statusCode: 401 })
    }

    if (!user) {
      throw new ClientError('unauthorized. user required', { statusCode: 401 })
    }

    if (user.credential === 'root') {
      return next()
    }

    if (session?.customer_name) {
      if (session.customer_name !== customer.name) {
        throw new ClientError('Session conflict. Wrong organizations', {statusCode: 409})
      }

      return next()
    }

    if (!Array.isArray(user.customers)) {
      throw new ClientError('Invalid user definition', {statusCode: 403})
    }

    const idx = user.customers
      .map( c => { return c.name })
      .indexOf( customer.name )

    if (idx === -1) {
      var err = new Error('forbidden. you don\'t belong to this organization')
      err.statusCode = 403
      return next(err)
    }

    next()
  } catch (err) {
    return next(err)
  }
}
