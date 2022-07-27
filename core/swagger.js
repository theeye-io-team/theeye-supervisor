const swaggerJsdoc = require('swagger-jsdoc');
const execSync = require('child_process').execSync;
const fs = require("fs")

const ver = execSync('cd ' + process.cwd() + ' && git describe').toString().split("\n")[0]

const recursiveDirRead = (p) => {
  let arr = fs.readdirSync(process.cwd() + "/" + p)
  arr.forEach(d => {
    console.log(d)
    console.log(p)
    d = p + "/" + d
    if (fs.statSync(process.cwd() + "/" + d).isDirectory()) {
      let a = recursiveDirRead(p+"/"+d)
      d = a
    }
  })
  return arr
}

// const apis = recursiveDirRead('core/controllers').flat()
// console.log(apis)

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TheEye Supervisor',
      version: ver
    },
  },
  apis: ['core/controllers/*.js']  // files containing annotations as above
};

const openapiSpecification = swaggerJsdoc(options);

module.exports = openapiSpecification