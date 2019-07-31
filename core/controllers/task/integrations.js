const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:integrations');
const router = require('../../router');
const TaskConstants = require('../../constants')

module.exports = (server, passport) => {
  server.get(
    '/task/:task/credentials',
    [
      passport.authenticate('bearer', { session: false }),
      router.resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer,
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.ensureAllowed({ entity: { name: 'task' } })
    ],
    controller.credentials
  )
}

const controller = {
  /**
   * @summary get task credentials
   * @param {Mixed} task instance or id
   * @param {Function} next
   */
  credentials (req, res, next) {
    let task = req.task

    res.send(200, { id: task._id, secret: task.secret })
  }
}
