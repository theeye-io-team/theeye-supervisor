const net = require('net')
const logger = require('../../lib/logger')(':app:orchestrator')

module.exports = (App) => {

  const initialize = () => {
    const config = App.config.orchestrator

    if (process.env.ORCHESTRATOR_DISABLED === 'true') {
      logger.log('WARNING! App Orchestrator service is disabled via process.env')
      return
    }

    const sockets = new SocketsHandler()

    const server = net.createServer()

    if (!config.port) {
      throw new Error('orchestrator config.port not set')
    }

    server.on('connection', socket => {
      logger.log('New client connected')
      sockets.handle(socket)
    })

    server.on('error', (err) => {
      // Handle errors here.
      logger.error(err)
    })

    server.listen(config.port, '0.0.0.0', () => {
      logger.log('TheEye Orchestrator started. Listening at "%s"', server.address())
    })
  }

  class SocketsHandler {

    constructor (options) {
      this.sockets = []
    }

    handle (socket) {
      let index

      socket.on('close', () => {
        logger.log('disonnected')
        this.sockets.splice(index, 1)
        logger.log('connected sockets %s', this.sockets.length)
      })

      socket.on('data', data => {
        logger.log(data.toString())
        if (data.toString() === 'ready') {
          this.processJobs(socket)
        }
      })

      socket.write('say hello\r\n')

      this.sockets.push(socket)
      index = this.sockets.length - 1

      logger.log('connected sockets %s', this.sockets.length)
    }


    processJobs (socket) {
      new JobsRunner({
        listName: 'demo:jobs',
        socket,
        redisClient: App.redis.duplicate()
      })
    }

  }

  const JobsRunner = function (options) {

    const { redisClient, socket, listName } = options

    const popJob = () => {
      return new Promise( (resolve, reject) => {
        redisClient.blpop(listName, 0, (err, values) => {
          if (err) reject(err)
          else resolve(values)
        })
      })
    }

    const start = async () => {
      while (true) {
        const job = await popJob()

        logger.log(job)

        socket.write('NEW listName')
      }
    }

    start()

    return this
  }

  return initialize()
}
