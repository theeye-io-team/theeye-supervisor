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
    'core/controllers/index.js'
  ]  // files containing annotations as above
};

const spec = swaggerJsdoc(options);
spec.definitions = {}
spec.definitions.task = require('./entity/task/swagger.json')

module.exports = spec