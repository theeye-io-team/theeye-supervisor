
const logger = require('../lib/logger')(':router')
const auth = require('../lib/auth')

// @TODO avoiding dynamic linker
const IndicatorRouter       = require('../controllers/indicator')
const MainRouter            = require('../controllers/index')
const AgentRouter           = require('../controllers/agent')
const DStatRouter           = require('../controllers/dstat')
const EventRouter           = require('../controllers/event')
const HostStatRouter        = require('../controllers/host-stats')
const HostRouter            = require('../controllers/host')
const TemplatesRouter       = require('../controllers/hostgroup')
const JobsRouter            = require('../controllers/job')
const PSauxRouter           = require('../controllers/psaux')
const ResourcesRouter       = require('../controllers/resource')
const MonitorsRouter        = require('../controllers/monitor')
const ScriptsRouter         = require('../controllers/script')
const FilesRouter           = require('../controllers/file')
const RecipesRouter         = require('../controllers/recipe')
const SchedulerRouter       = require('../controllers/scheduler')
const TagsRouter            = require('../controllers/tags')
const TasksRouter           = require('../controllers/task')
const WebhooksRouter        = require('../controllers/webhook')
const WorkflowsRouter       = require('../controllers/workflow')
const UsageRouter           = require('../controllers/usage')
// DEPRECATED - In Progress
const AuthRouter            = require('../controllers/auth')

const notify = require('./notify-middleware')
const resolve = require('./param-resolver')
const filter = require('./param-filter')
const requireCredential = require('./require-credential')
const requireSecret = require('./require-secret')
const ensureCustomer = require('./ensure-customer')
const ensureCustomerBelongs = require('./ensure-customer-belongs')
const ensureAllowed = require('./ensure-allowed')
const ensureHeader = require('./ensure-header')

/**
 *
 * router middlewares
 *
 */
module.exports = {
  notify,
  resolve,
  filter,
  requireCredential,
  requireSecret,
  ensureCustomer,
  ensureCustomerBelongs,
  ensureAllowed,
  ensureHeader,
  load (server) {
    logger.log('loading routes')
    server.auth = auth.initialize()

    IndicatorRouter    (server) 
    MainRouter         (server) 
    AgentRouter        (server) 
    DStatRouter        (server) 
    EventRouter        (server) 
    HostStatRouter     (server) 
    HostRouter         (server) 
    TemplatesRouter    (server) 
    JobsRouter         (server) 
    PSauxRouter        (server) 
    ResourcesRouter    (server) 
    MonitorsRouter     (server) 
    ScriptsRouter      (server) 
    FilesRouter        (server) 
    RecipesRouter      (server) 
    SchedulerRouter    (server) 
    TagsRouter         (server) 
    TasksRouter        (server) 
    WebhooksRouter     (server) 
    WorkflowsRouter    (server) 
    UsageRouter        (server) 
    AuthRouter         (server) 

  }
}
