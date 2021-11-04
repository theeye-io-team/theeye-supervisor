const isEmail = require('validator/lib/isEmail')
const logger = require('../../lib/logger')('controller:job')
const App = require('../../app')
const ACL = require('../../lib/acl')
const audit = require('../../lib/audit')
const Constants = require('../../constants/task')
const dbFilter = require('../../lib/db-filter')
const Host = require('../../entity/host').Entity
//const IntegrationConstants = require('../../constants/integrations')
const LifecycleConstants = require('../../constants/lifecycle')
const router = require('../../router')
const StateConstants = require('../../constants/states')
const TaskConstants = require('../../constants/task')
const TopicsConstants = require('../../constants/topics')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  /**
   * get a single job information
   */
  server.get('/:customer/job/:job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    controller.get
  )

  server.get('/job/running_count',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    controller.fetchRunningCounters
  )

  server.get('/job/running',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    controller.fetchRunning
  )

  /**
   * fetch many jobs information
   */
  server.get('/:customer/job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.hostnameToHost(),
    (req, res, next) => {
      if (req.user.credential === 'agent') {
        controller.queue(req, res, next)
      } else {
        controller.fetch(req, res, next)
      }
    }
  )

  server.put('/:customer/job/:job',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }),
    router.resolve.idToEntity({ param: 'job', required: true }),
    controller.finish,
    afterFinishJobHook
  )

  server.put('/job/:job/assignee',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.updateAssignee
  )

  server.get('/job/:job/participants',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.participants
  )

  server.get('/job/:job/input',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.input
  )

  server.get('/job/:job/output',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.output
  )
}

const controller = {
  get (req,res,next) {
    res.send(200, req.job)
  },
  /**
   * @method GET
   * @route /:customer/job
   */
  queue (req, res, next) {
    const { customer, user, host } = req
    if (!host) { return res.send(400, 'host is required') }

    if (customer.disabled === true || host.disabled === true) {
      App.jobDispatcher.getAgentUpdateJob(host, (err, job) => {
        if (err) { return res.send(500) }
        res.send(200, { jobs: [ job ] })
      })
    } else {
      logger.log('agent querying queue')
      App.jobDispatcher.getNextPendingJob(
        { customer, user, host: req.host },
        (err, job) => {
          if (err) { return res.send(500, err.message) }

          let jobs = []
          if (job) {
            jobs.push(job.publish('agent'))
            App.scheduler.scheduleJobTimeoutVerification(job)
          }

          res.send(200, { jobs })
          next()
        }
      )
    }
  },
  /**
   * @method GET
   * @route /:customer/job
   */
  fetch (req, res, next) {
    const customer = req.customer
    const user = req.user

    const filters = dbFilter(req.query, { /** default **/ })
    filters.where.customer_id = customer._id.toString()

    filters.include = Object.assign(filters.include, {
      task_arguments_values: 0,
      script_arguments: 0,
      output: 0,
      result: 0,
      task: 0,
      script: 0
    })

    if (!ACL.hasAccessLevel(req.user.credential, 'admin')) {
      filters.where.acl = req.user.email
    }

    App.Models.Job.Job.fetchBy(filters)
      .then(jobs => {
        res.send(200, jobs)
        next()
      })
      .catch(res.sendError)
  },
  fetchRunning (req, res, next) {
    const customer = req.customer
    const user = req.user
    const query = req.query

    logger.log('querying jobs')

    const filters = dbFilter(query, { /** default **/ })
    filters.where.customer_id = customer._id.toString()
    filters.where.lifecycle = {
      $in: [
        LifecycleConstants.READY,
        LifecycleConstants.ASSIGNED,
        LifecycleConstants.ONHOLD,
        LifecycleConstants.SYNCING,
        LifecycleConstants.LOCKED
      ]
    }

    //filters.include = {
    //  task_id: 1,
    //  workflow_id: 1,
    //  workflow_job_id: 1,
    //  lifecycle: 1,
    //  state: 1,
    //  _type: 1,
    //  name: 1,
    //  creation_date: 1
    //}

    if ( !ACL.hasAccessLevel(req.user.credential, 'admin') ) {
      // find what this user can access
      filters.where.acl = req.user.email
    }

    //filters.limit = 1
    App.Models.Job.Job.fetchBy(filters, (err, jobs) => {
      if (err) {
        return res.send(500, err)
      }

      const data = []
      jobs.forEach(job => {
        data.push(job.publish())
      })
      res.send(200, data)
      next()
    })
  },
  async fetchRunningCounters (req, res, next) {
    try {
      const customer = req.customer
      const user = req.user
      const query = req.query

      logger.log('querying jobs counters')

      const $match = {
        customer_id: customer._id.toString(),
        lifecycle: {
          $in: [
            LifecycleConstants.READY,
            LifecycleConstants.ASSIGNED,
            LifecycleConstants.ONHOLD,
            LifecycleConstants.SYNCING,
            LifecycleConstants.LOCKED
          ]
        }
      }

      if ( !ACL.hasAccessLevel(req.user.credential, 'admin') ) {
        // find what this user can access
        $match.acl = req.user.email
      }

      const counters = await App.Models.Job.Job.aggregate([
        { $match }, {
          $group: {
            _id: {
              task_id: "$task_id",
              workflow_id: "$workflow_id"
            },
            task_id: { $first: "$task_id" },
            workflow_id: { $first: "$workflow_id" },
            count: { $sum: 1 }
          }
        }
      ])

      res.send(200, counters)
      next()
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   *
   * @method PUT
   * @summary finish a job. change its lifecycle
   *
   */
  finish (req, res, next) {
    const { user, job } = req
    const payload = req.body.result || {}

    // prevent canceled job to be updated
    if (job.lifecycle !== LifecycleConstants.ASSIGNED) {
      return res.send(200)
    }

    logger.log(`job "${job.name}(${job._id})" finished`)
    logger.data(payload)

    App.jobDispatcher.finish({
      result: Object.assign({}, (payload.data || {}), {
        user: { email: user.email, id: user.id }
      }),
      state: payload.state,
      job,
      user,
      customer: req.customer
    }, (err, job) => {
      if (err) {
        return res.send(500)
      }
      res.send(200, job)
      next()
    })
  },
  async updateAssignee (req, res, next) {
    try {
      const job = req.job
      const search = req.body

      if (!Array.isArray(search) || search.length === 0) {
        throw new ClientError('invalid format')
      }

      for (let value of search) {
        if (typeof value !== 'string') {
          throw new ClientError(`invalid body payload format. wrong value ${value}`)
        }
      }

      const members = await App.gateway.member.fetch(search, { customer_id: req.customer.id })
      if (!members || members.length === 0) {
        throw new ClientError('invalid members')
      }

      // job acl
      for (let member of members) {
        if (member.user_id && member.user.email) {
          ACL.ensureAllowed({
            email: member.user.email,
            credential: member.credential,
            model: job
          })
        }
      }

      job.user_inputs_members = []
      job.assigned_users = []

      for (let member of members) {
        const user = member.user
        job.user_inputs_members.push(member.id)
        job.assigned_users.push(user.id)
        if (!job.acl.includes(user.email)) {
          job.acl.push(user.email)
        }
      }

      await job.save()
      res.send(200, job.user_inputs_members)
    } catch (err) {
      res.sendError(err)
    }
  },
  async participants (req, res, next) {
    try {
      const job = req.job

      let search = []
      search.push(job.user_id)

      if (
        job.assigned_users.length > 1 || 
        (
          job.assigned_users.length === 1 &&
          job.assigned_users[0] !== job.user_id
        )
      ) {
        search = search.concat(job.assigned_users)
      }

      if (job.acl.length >= 1) {
        search = search.concat(job.acl)
      }

      const members = await App.gateway.member.fetch(search, { customer_id: req.customer.id })

      const users = membersToUsers(members)
      const participants = {
        owner: users.find(user => user.id === job.user_id),
        assignee: searchUsers(users, job.assigned_users),
        observers: searchUsers(users, job.acl)
      }

      res.send(200, participants)
    } catch (err) {
      res.sendError(err)
    }
  },
  input (req, res, next) {
    const values = req.job.task_arguments_values

    if (req.query.hasOwnProperty("include_definitions")) {
      const definitions = [...req.job.task.task_arguments]

      for (let index = 0; index < definitions.length; index++) {
        definitions[index].value = values[index]
      }

      res.send(200, definitions)
    } else {
      res.send(200, values)
    }

    next()
  },
  output (req, res, next) {
    res.send(200, req.job.output)
    next()
  }
}

const searchUsers = (users, search) => {
  const results = []
  for (let value of search) {
    const matched = users.find(user => {
      return (
        user.id === value ||
        user.email === value ||
        user.username === value
      )
    })

    if (matched !== undefined) {
      results.push(matched)
    }
  }
  return results
}

const membersToUsers = (members) => {
  const users = []

  if (!members || members.length === 0) {
    return []
  }
  for (let member of members) {
    users.push(member.user)
  }

  return users
}

const afterFinishJobHook = (req, res, next) => {
  const job = req.job

  const updateHostIntegration = () => {
    switch (job._type) {
      case 'NgrokIntegrationJob':
        updateNgrokHostIntegration()
        break;
      default:
        // any other integration ?
        break;
    }
  }

  const updateNgrokHostIntegration = () => {
    const host = job.host
    var ngrok = host.integrations.ngrok
    ngrok.result = job.result
    ngrok.last_update = new Date()

    if (job.state === StateConstants.INTEGRATION_STARTED) {
      // obtain tunnel url
      if (job.result && job.result.url) {
        ngrok.active = true
        ngrok.url = job.result.url
      }
    } else if (job.state === StateConstants.INTEGRATION_STOPPED) {
      // tunnel closed. url is no longer valid
      ngrok.active = false
      ngrok.url = ''
    } else if (job.state === StateConstants.FAILURE) {
      logger.error('integration job failed to ejecute. %o', job)
    }

    let integrations = Object.assign({}, host.integrations, { ngrok })
    Host.update(
      { _id: host._id },
      {
        $set: { integrations: integrations.toObject() }
      },
      (err) => {
        if (err) logger.error('%o', err)

        App.notifications.generateSystemNotification({
          topic: TopicsConstants.host.integrations.crud,
          data: {
            hostname: host.hostname,
            organization: req.customer.name,
            organization_id: req.customer._id,
            operation: Constants.UPDATE,
            model_type: host._type,
            model_id: host._id,
            model: {
              id: host._id,
              integrations: { ngrok: host.integrations.ngrok }
            }
          }
        })

        next()
      }
    )
  }

  // is an integration job ?
  if (job.isIntegrationJob()===true) {
    if (job.populated('host')===undefined) {
      job.populate('host', () => {
        updateHostIntegration()
      })
    } else {
      updateHostIntegration()
    }
  }
}
