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

    'core/controllers/recipe/crud.js',
    'core/controllers/resource/index.js',
    'core/controllers/scheduler/index.js',
    
    'core/controllers/usage/index.js'
  ]  // files containing annotations as above
};

const spec = swaggerJsdoc(options);
spec.definitions = {}
spec.definitions.task = require('./entity/task/swagger.json')
spec.definitions.indicator = require('./entity/indicator/swagger.json')

module.exports = spec