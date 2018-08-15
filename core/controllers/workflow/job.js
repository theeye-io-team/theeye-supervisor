const App = require('../../app')
const router = require('../../router')
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
      //router.ensureBelongsToCustomer({ documentName: 'task' }),
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
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      res.send(200, job)
      req.job = job
      next()
    })
  }
}
