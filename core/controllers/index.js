
const os = require('os')
const exec = require('child_process').exec

module.exports = (server) => {
  server.get('/api', (req, res, next) => {
    res.send(200, `Hi, I am ok. Thanks for asking`)
  })

  server.get('/api/status', nodeStatus)
}

const nodeStatus = async (req, res) => {
  try {
    let message = { status: `Node is ok.` }

    message.node_hostname = process.env.THEEYE_NODE_HOSTNAME || os.hostname()
    message.node_uptime = new Date(Date.now() - os.uptime()*1000)
    message.process_uptime = new Date(Date.now() - process.uptime()*1000)
    message.theeye_version = (await getVersion().catch(err => '')).trim()
    message.load_average = os.loadavg()
    message.env = process.env.NODE_ENV

    res.send(200, message)
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
