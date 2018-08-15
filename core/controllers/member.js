
const logger = require('../lib/logger')('controller:member')
const UserService = require('../service/user')
const router = require('../router')

module.exports = function (server, passport) {
  /**
   *
   * crud operations
   *
   */
  server.patch(
    '/:customer/member/:member/credential',
    [
      passport.authenticate('bearer', { session: false }),
      router.requireCredential('manager'),
      router.resolve.idToEntity({
        param: 'member',
        entity: 'user',
        required: true
      }),
      router.filter.spawn({ param: 'customers', filter: 'toArray' }),
      router.filter.spawn({ param: 'customers', filter: 'uniq' }),
    ],
    controller.updateCrendential
  )

  server.patch(
    '/:customer/member/:member/customers',
    [
      passport.authenticate('bearer', { session: false }),
      router.requireCredential('manager'),
      router.resolve.idToEntity({
        param: 'member',
        entity: 'user',
        required: true
      }),
      router.filter.spawn({ param: 'customers', filter: 'toArray' }),
      router.filter.spawn({ param: 'customers', filter: 'uniq' }),
    ],
    controller.updateCustomers
  )

  server.del(
    '/:customer/member/:member',
    [
      passport.authenticate('bearer', { session: false }),
      router.requireCredential('manager'),
      router.resolve.idToEntity({
        param: 'member',
        entity: 'user',
        required: true
      })
    ],
    controller.removeFromCustomer
  )
}

const controller = {
  updateCrendential (req, res, next) {
    var member = req.member
    var credential = req.body.credential

    if (!credential) {
      return res.send(400, 'credential required')
    }

    updateMember(member, { credential }, res, next)
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
