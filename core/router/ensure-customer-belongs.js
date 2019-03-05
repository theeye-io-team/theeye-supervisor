module.exports = (name) => {
  return (req, res, next) => {
    const customer = req.customer
    const resource = req[name]

    let customer_id = (resource.customer_id || resource.customer).toString()

    if (customer_id) {
      if (customer_id.toString() !== customer._id.toString()) {
        return res.send(401, 'forbidden')
      } else {
        return next()
      }
    } else {
      return res.send(500, 'cannot determine customer')
    }
  }
}
