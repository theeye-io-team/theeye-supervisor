const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:workflow:job')
const JobConstants = require('../../constants/jobs')

module.exports = (server, passport) => {
  const middlewares = [
    passport.authenticate('bearer', { session: false }),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  // create a new workflow-job instance
  server.post(
    '/workflow/:workflow/job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({ param: 'workflow', required: true }),
      router.ensureAllowed({ entity: { name: 'workflow' } })
    ),
    controller.create
  )

  // create job using task secret key
  server.post(
    '/workflow/:workflow/secret/:secret/job', [
      router.resolve.customerNameToEntity({ required: true }),
      router.resolve.idToEntity({ param: 'task', required: true }),
      router.requireSecret('workflow')
    ],
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    controller.create
  )
}

const controller = {
  create (req, res, next) {
    let { workflow, user, customer } = req
    let args = req.body.task_arguments || []

    App.jobDispatcher.createByWorkflow({
      workflow,
      user,
      customer,
      notify: true,
      task_arguments_values: args,
      origin: (req.origin || JobConstants.ORIGIN_USER)
    }, (err, job) => {
      if (err) {
        logger.error('%o', err)
        return res.send(err.statusCode || 500, err.message)
      }

      let data = job.publish()
      data.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }

      res.send(200, data)
      req.job = job
      next()
    })
  }
}
