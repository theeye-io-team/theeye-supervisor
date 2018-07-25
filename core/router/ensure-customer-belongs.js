/**
 *
 * @summary given a customer and database document , ensure the document belongs to the customer
 *
 */
module.exports = (options) => {
  return function (req, res, next) {
    const customer = req.customer
    const doc = req[options.documentName]

    if (!customer) {
      var err = new Error('unauthorized. specify the customer')
      err.statusCode = 401
      return next(err)
    }

    if (!doc) {
      var err = new Error('unauthorized. specify the ' + options.name)
      err.statusCode = 401
      return next(err)
    }

    return next()
  }
}
