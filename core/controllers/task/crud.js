const isMongoId = require('validator/lib/isMongoId')
const ObjectId = require('mongoose').Types.ObjectId
const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:crud')
const router = require('../../router')
const ErrorHandler = require('../../lib/error-handler')
const audit = require('../../lib/audit')
const TaskConstants = require('../../constants/task')
//const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  const increaseVersion = async (req, res) => {
    try {
      const task = req.task
      const fingerprint = task.calculateFingerprint(App.namespace)
      // is a new version ?
      if (task.fingerprint !== fingerprint) {
        task.fingerprint = fingerprint
      }
      if (typeof task.version !== 'number') {
        task.version = 1
      } else {
        task.version += 1
      }
      await task.save()
    } catch (err) {
      logger.error(err)
    }
  }

  const identityMiddleware = (credential) => {
    return ([
      server.auth.bearerMiddleware,
      router.resolve.customerSessionToEntity(),
      router.ensureCustomer,
      router.requireCredential(credential),
    ])
  }

  server.get('/:customer/task',
    identityMiddleware('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'host', required: false }),
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  server.get('/task',
    identityMiddleware('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'host', required: false }),
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  server.get('/:customer/task/:task',
    identityMiddleware('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.get
  )

  server.get('/task/:task',
    identityMiddleware('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    controller.get
  )

  server.get('/task/version',
    identityMiddleware('admin'),
    controller.version
  )

  server.post('/:customer/task',
    identityMiddleware('admin'),
    router.resolve.idToEntityByCustomer({ param: 'script', entity: 'file' }),
    router.resolve.idToEntityByCustomer({ param: 'host' }),
    controller.create,
    audit.afterCreate('task', { display: 'name' })
  )

  server.patch('/:customer/task/:task',
    identityMiddleware('admin'),
    router.resolve.idToEntityByCustomer({ param: 'script', entity: 'file' }),
    router.resolve.idToEntityByCustomer({ param: 'host' }),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.resolve.idToEntityByCustomer({ param: 'host_id', entity: 'host', into: 'host' }),
    controller.replace,
    increaseVersion,
    audit.afterUpdate('task', { display: 'name' })
  )

  server.put('/:customer/task/:task',
    identityMiddleware('admin'),
    router.resolve.idToEntityByCustomer({ param: 'script', entity: 'file' }),
    router.resolve.idToEntityByCustomer({ param: 'host' }),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    router.resolve.idToEntityByCustomer({ param: 'host_id', entity: 'host', into: 'host' }),
    controller.replace,
    increaseVersion,
    audit.afterReplace('task', { display: 'name' })
  )

  server.del('/:customer/task/:task',
    identityMiddleware('admin'),
    router.resolve.idToEntityByCustomer({ param: 'task', required: true }),
    controller.remove,
    audit.afterRemove('task', { display: 'name' })
  )
}

const controller = {
  create (req, res, next) {
    const errors = new ErrorHandler()
    const input = Object.assign({}, req.body, {
      customer: req.customer,
      customer_id: req.customer._id,
      user: req.user,
      user_id: req.user_id
    })

    if (!input.name) errors.required('name', input.name)
    if (!input.type) errors.required('type', input.type)

    if (
      input.type === TaskConstants.TYPE_SCRIPT ||
      input.type === TaskConstants.TYPE_SCRAPER
    ) {
      if (!req.host) {
        errors[!req.body.host ? 'required' : 'invalid']('host', req.host)
      } else {
        input.host = req.host._id
        input.host_id = req.host._id
      }
    }

    if (input.type === TaskConstants.TYPE_APPROVAL) {
      if (!validIdsArray(input.approvers)) {
        errors.required('approvers', input.approvers)
      }
    }

    if (
      input.type === TaskConstants.TYPE_SCRIPT ||
      input.type === TaskConstants.TYPE_NODEJS
    ) {
      if (!req.script && !input.script?.data) {
        errors[!req.body.script ? 'required' : 'invalid']('script', req.script)
      }

      if (req.script) {
        input.script = req.script
      }

      if (!input.script_runas) {
        errors.required('script_runas', input.script_runas)
      }
    }

    if (input.type === TaskConstants.TYPE_SCRAPER) { }
    if (input.type === TaskConstants.TYPE_DUMMY) { }
    if (input.type === TaskConstants.TYPE_NOTIFICATION) { }
    if (errors.hasErrors()) {
      return res.send(400, errors)
    }

    App.task.create(input, async (err, task) => {
      if (err) { return res.sendError(err) }

      try {
        const data = await App.task.populate(task)
        res.send(200, data)
        req.task = task
        next()
      } catch (err) {
        return res.sendError(err)
      }
    })
  },
  /**
   * @method GET
   * @route /task
   */
  fetch (req, res, next) {
    const customer = req.customer
    const input = req.query
    const filter = req.dbQuery

    // exclude tasks with no host assigned or with invalid script/data
    if (
      ! Object.prototype.hasOwnProperty.call(input, 'unassigned') &&
      input.unassigned !== true &&
      input.unassigned !== 'true'
    ) {
      // filter all unusable tasks
      filter.where.$or = [
        { _type: { $nin: ['ScriptTask', 'ScraperTask'] } },
        {
          $and: [
            { host_id: { $ne: null, $exists: true } },
            {
              $or: [
                { _type: 'ScriptTask', script_id: { $ne: null, $exists: true } },
                { _type: 'ScraperTask' }
              ]
            }
          ]
        }
      ]
    }

    if (req.host) {
      filter.where.host_id = req.host._id.toString()
    }

    App.task.fetchBy(filter, (err, tasks) => {
      if (err) { return res.send(500) }
      res.send(200, tasks)
    })
  },
  /**
   *
   * @author Facundo
   * @method GET
   * @route /:customer/task/:task
   * @param {String} :task , mongo ObjectId
   *
   */
  async get (req, res) {
    try {
      const data = await App.task.populate(req.task)
      res.send(200, data)
    } catch (e) {
      res.sendError(e)
    }
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   * @route /:customer/task/:task
   * @param {String} :task , mongo ObjectId
   *
   */
  remove (req, res, next) {
    const task = req.task

    App.task.remove({
      task: task,
      user: req.user,
      customer: req.customer,
      done: function () {
        res.send(200, {})
        next()
      },
      fail: (err) => { res.sendError(err) }
    })
  },
  /**
   *
   * @author Facundo
   * @method PATCH/PUT
   * @route /:customer/task/:task
   * @param {String} :task , mongo ObjectId
   * @param ...
   *
   */
  replace (req, res, next) {
    const errors = new ErrorHandler()
    const input = Object.assign({}, req.body)

    if (!req.task) {
      return res.send(400, errors.required('task'))
    }
    if (!input.name) {
      return res.send(400, errors.required('name'))
    }

    delete input.type
    const type = req.task.type

    if (
      type !== TaskConstants.TYPE_APPROVAL &&
      type !== TaskConstants.TYPE_DUMMY &&
      type !== TaskConstants.TYPE_NOTIFICATION
    ) {
      if (!req.host) {
        errors[!req.body.host ? 'required' : 'invalid']('host', req.host)
      }
    }

    if (type === TaskConstants.TYPE_APPROVAL) {
      if (!validIdsArray(input.approvers)) {
        errors.required('approvers', input.approvers)
      }
    }

    if (req.task.type === TaskConstants.TYPE_SCRIPT) {
      if (!req.script) {
        errors[!req.body.script ? 'required' : 'invalid']('script', req.script)
      }
      input.script = req.script
    }

    if (type === TaskConstants.TYPE_SCRAPER) { }
    if (type === TaskConstants.TYPE_DUMMY) { }
    if (type === TaskConstants.TYPE_NOTIFICATION) { }

    if (errors.hasErrors()) {
      return res.send(400, errors)
    }

    logger.log('updating task %j', input)
    App.task.update({
      user: req.user,
      customer: req.customer,
      task: req.task,
      updates: input,
      done: function (task) {
        res.send(200, task)
        next()
      },
      fail: function (err) {
        logger.error('%o', err)
        res.sendError(err)
      }
    })
  },
  async version (req, res) {
    try {
      const { customer, query } = req

      const $match = {
        customer_id: customer._id.toString(),
      }

      if (Array.isArray(req.permissions)) {
        // find what this user can access
        $match.acl = req.permissions.map(p => p.value)
      }

      const tasks = await App.Models.Task.Task.aggregate([
        { $match },
        {
          $project: {
            fingerprint: 1,
            version: { $ifNull: [ '$version', 1 ] },
            name: 1,
            type: 1,
            id: '$_id',
            _type: 1
          }
        },
        {
          $sort: {
            fingerprint: 1,
            version: 1
          }
        },
        {
          $group: {
            _id: {
              fingerprint: '$fingerprint',
              version: '$version'
            },
            task: {
              $first: '$$ROOT'
            }
          }
        },
        { $replaceRoot: { newRoot: "$task" } }
      ])

      res.send(200, tasks)
    } catch (err) {
      res.sendError(err)
    }
  }
}

const validIdsArray = (value) => {
  if (!value) {
    return false
  } else {
    if (!Array.isArray(value)) {
      return false
    } else {
      const invalid = value.find(_id => !isMongoId(_id))
      if (invalid) {
        return false
      }
    }
  }
  return true
}
