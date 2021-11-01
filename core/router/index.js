
const logger = require('../lib/logger')(':router')
const auth = require('../lib/auth')

/**
 *
 * router middlewares
 *
 */
module.exports = {
  notify: require('./notify-middleware'),
  resolve: require('./param-resolver'),
  filter: require('./param-filter'),
  requireCredential: require('./require-credential'),
  requireSecret: require('./require-secret'),
  ensureCustomer: require('./ensure-customer'),
  ensureCustomerBelongs: require('./ensure-customer-belongs'),
  ensureAllowed: require('./ensure-allowed'),
  ensureHeader: require('./ensure-header'),
  load (server) {
    logger.log('loading controllers')

    server.auth = auth.initialize()

    // @TODO avoiding dynamic linker
    require('../controllers/indicator')(server)
    require('../controllers/index')(server)
    require('../controllers/agent')(server)
    require('../controllers/dstat')(server)
    require('../controllers/event')(server)
    require('../controllers/host-stats')(server)
    require('../controllers/host')(server)
    require('../controllers/hostgroup')(server)
    require('../controllers/job')(server)
    require('../controllers/psaux')(server)
    require('../controllers/resource')(server)
    require('../controllers/monitor')(server)
    require('../controllers/script')(server)
    require('../controllers/file')(server)
    require('../controllers/recipe')(server)
    require('../controllers/scheduler')(server)
    require('../controllers/tags')(server)
    require('../controllers/task')(server)
    require('../controllers/webhook')(server)
    require('../controllers/workflow')(server)
    //require('../controllers/integrations')(server)
    require('../controllers/usage')(server)
    // DEPRECATED - In Progress
    require('../controllers/auth')(server)
  }
}
