module.exports = function (req, res, next) {
  const { customer, user, session } = req

  if (!customer) {
    const err = new Error('unauthorized. customer required')
    err.statusCode = 401
    return next(err)
  }

  if (!user) {
    const err = new Error('unauthorized. user required')
    err.statusCode = 401
    return next(err)
  }

  if (user.credential === 'root') {
    return next()
  }

  if (session?.customer_name) {
    if (session.customer_name === customer.name) {
      return next()
    } else {
      const err = new Error('Incorrect Organizations. Session conflict')
      err.statusCode = 409
      return next(err)
    }
  }

  let idx = user.customers
    .map( c => { return c.name })
    .indexOf( customer.name )

  if (idx === -1) {
    var err = new Error('forbidden. you don\'t belong to this organization')
    err.statusCode = 403
    return next(err)
  }

  return next()
}
