const swaggerJsdoc = require('swagger-jsdoc');
const execSync = require('child_process').execSync;

const ver = execSync('cd ' + process.cwd() + ' && git describe').toString().split("\n")[0]

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TheEye Supervisor',
      version: ver
    },
  },
  apis: [
    'core/controllers/index.js',
    'core/controllers/indicator/crud.js',
    'core/controllers/job/create.js',
    'core/controllers/job/crud.js',
    'core/controllers/job/lifecycle.js',
    'core/controllers/job/result.js',
    'core/controllers/marketplace/crud.js',
    'core/controllers/monitor/crud.js',
    'core/controllers/monitor/nested.js',
    'core/controllers/monitor/runner.js',
    'core/controllers/recipe/crud.js',
    'core/controllers/resource/index.js',
    'core/controllers/scheduler/index.js',
    'core/controllers/task/acl.js',
    
    'core/controllers/task/integrations.js',
    'core/controllers/task/job.js',
    'core/controllers/task/scheduler.js',
    'core/controllers/task/serialize.js',
    'core/controllers/usage/index.js',
    'core/controllers/workflow/acl.js',
    'core/controllers/workflow/crud.js',
    'core/controllers/workflow/graph.js',
    'core/controllers/workflow/integrations.js',
    'core/controllers/workflow/job.js',
    'core/controllers/workflow/scheduler.js',
    'core/controllers/workflow/serialization.js',
    'core/controllers/workflow/triggers.js',
    'core/controllers/agent.js',    
    'core/controllers/auth.js',    
    'core/controllers/dstat.js',    
    'core/controllers/event.js',    
    'core/controllers/file.js',    
    'core/controllers/host-stats.js',    
    'core/controllers/host.js',    
    'core/controllers/hostgroup.js',    
    'core/controllers/psaux.js',    
    'core/controllers/script.js',    
    'core/controllers/tags.js',    
    'core/controllers/webhook.js',    
  ]  // files containing annotations as above
};

const spec = swaggerJsdoc(options);
spec.definitions = {}
spec.definitions.task = require('./entity/task/swagger.json')
spec.definitions.indicator = require('./entity/indicator/swagger.json')

module.exports = spec