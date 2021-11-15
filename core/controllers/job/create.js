const App = require('../../app')
const restify = require('restify')
const createJob = require('../../service/job/create')
const router = require('../../router')
const JobConstants = require('../../constants/jobs')

module.exports = (server) => {

  server.post('/:customer/job',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
  )

  server.post('/job',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
    //restify.plugins.conditionalHandler([
    //  { version: '1.0.0', handler: createJob },
    //  { version: '2.9.0', handler: createFromFiles }
    //])
  )

  // create job using task secret key
  server.post('/job/secret/:secret',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.requireSecret('task'),
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    createJob
  )
}

//const createFromFiles = (req, res, next) => {
//
//  const form = formidable({ multiples: true })
//
//  form.parse(req, (err, fields, files) => {
//    if (err) {
//      res.sendError(err)
//      return;
//    }
//    res.send(200,{ fields, files })
//  })
//}
