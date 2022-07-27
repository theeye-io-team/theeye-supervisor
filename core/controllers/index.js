const os = require('os')
const exec = require('child_process').exec
const swagger = require('../swagger')

module.exports = (server) => {

  /** 
   * @openapi
   * /api:
   *  get:
   *    description: Check if the API is running.
   *    responses: 
   *      200:
   *        description: The API is running.
  */

  server.get('/api', (req, res, next) => {
    res.send(200, `Hi, I am ok. Thanks for asking`)
  })

  /** 
   * @openapi
   * /api/status:
   *  get:
   *    description: Request supervisor and host machine information.
   *    responses: 
   *      200:
   *        description: JSON object with supervisor and host machine information.
  */

  server.get('/api/status', nodeStatus)

  /**
   * @openapi
   * /api/swagger:
   *  get:
   *    description: Get the API documentation in standard OpenAPI format
   *    responses: 
   *      200: 
   *        description: JSON object with the API documentation in OpenAPI format
   *      500: 
   *        description: The devs fucked up
   */
  server.get('/api/swagger', (req, res, next) => {
    res.send(200, swagger)
  })

}

const nodeStatus = async (req, res, next) => {
  try {
    let message = { status: `Node is ok.` }

    message.node_hostname = process.env.THEEYE_NODE_HOSTNAME || os.hostname()
    message.node_uptime = new Date(Date.now() - os.uptime()*1000)
    message.process_uptime = new Date(Date.now() - process.uptime()*1000)
    message.theeye_version = (await getVersion().catch(err => '')).trim()
    message.load_average = os.loadavg()
    message.env = process.env.NODE_ENV

    res.send(200, message)
    next()
  } catch (err) {
    res.send(500, err)
  }
}

const getVersion = () => {
  return new Promise( (resolve, reject) => {
    if (process.env.APP_VERSION) {
      return resolve(process.env.APP_VERSION)
    }

    const cmd = 'cd ' + process.cwd() + ' && git describe'
    exec(cmd, {}, (err, stdout, stderr) => {
     
      if (err) reject(err)
      resolve(stdout)
    })
  })
}
