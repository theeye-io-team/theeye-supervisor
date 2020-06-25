
const os = require('os')
const exec = require('child_process').exec

module.exports = (server) => {
  server.get('/', (req, res, next) => {
    res.send(200, `Hi, I am ok. Thanks for asking`)
  })

  server.get(
    '/status',
    //server.auth.bearerMiddleware,
    //router.requireCredential('root'),
    nodeStatus
  )
}

const nodeStatus = async (req, res, next) => {
  try {
    let message = { status: `Node is ok.` }

    message.node_hostname = process.env.THEEYE_NODE_HOSTNAME || os.hostname()
    message.node_uptime = new Date(Date.now() - os.uptime()*1000)
    message.process_uptime = new Date(Date.now() - process.uptime()*1000)
    message.theeye_version = (await getVersion()).trim()
    message.load_average = os.loadavg()

    res.send(200, message)
    next()
  } catch (err) {
    res.send(500, err)
  }
}

const getVersion = () => {
  return new Promise( (resolve, reject) => {
    const cmd = 'cd ' + process.cwd() + ' && git describe'
    exec(cmd, {}, (err, stdout, stderr) => {
      if (err) reject(err)
      resolve(stdout)
    })
  })
}
