
const logger = require('../lib/logger')('controller:member')
const UserService = require('../service/user')
const router = require('../router')

module.exports = function (server, passport) {
  const middleware = [
    passport.authenticate('bearer', { session: false }),
    router.requireCredential('manager'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
    router.resolve.idToEntity({
      param: 'member',
      entity: 'user',
      required: true
    })
  ]
  /**
   *
   * crud operations
   *
   */
  server.patch(
    '/:customer/member/:member/credential',
    middleware.concat([
      router.filter.spawn({ param: 'customers', filter: 'toArray' }),
      router.filter.spawn({ param: 'customers', filter: 'uniq' }),
    ]),
    controller.updateCrendential
  )

  server.patch(
    '/:customer/member/:member/customers',
    middleware.concat([
      router.filter.spawn({ param: 'customers', filter: 'toArray' }),
      router.filter.spawn({ param: 'customers', filter: 'uniq' }),
    ]),
    controller.updateCustomers
  )

  server.del(
    '/:customer/member/:member',
    middleware,
    controller.removeFromCustomer
  )
}

const controller = {
  updateCrendential (req, res, next) {
    const member = req.member
    const credential = req.body.credential

    if (!credential) {
      return res.send(400, 'credential required')
    }

    // member is a User entity !!!
    member.credential = credential
    member.save(err => {
      if (err) {
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      res.send(200, { id: member.id, credential })
      return next()
      // call publish if the member data is required in the response.
      //member.publish(
      //  { include_customers: true },
      //  (err, data) => {
      //    if (err) { return res.send(500, 'internal error') }
      //    res.send(200, data)
      //    return next()
      //  }
      //)
    })
  },
  updateCustomers (req, res, next) {
    var member = req.member
    var customers = req.customers

    if (!customers || customers.length === 0) {
      return res.send(400, 'customers required')
    }

    updateMember(member, { customers }, res, next)
  },
  removeFromCustomer (req, res, next) {
    const customerToRemove = req.customer
    const member = req.member

    let customers = member.customers
      .map(customer => customer.name)
      .filter(customerName => customerName !== customerToRemove.name)

    updateMember(member, { customers }, res, next)
  }
}

const updateMember = (member, updates, res, next) => {
  UserService.update(
    member._id,
    updates,
    (err, user) => {
      if (err) {
        logger.error(err)
        res.send(err.statusCode || 500, err.message)
        return next()
      }

      user.publish(
        { include_customers: true },
        (err, data) => {
          if (err) { return res.send(500, 'internal error') }
          res.send(200, data)
          return next()
        }
      )
    }
  )
}
