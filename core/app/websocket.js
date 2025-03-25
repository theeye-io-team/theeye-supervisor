const WebSocket = require('ws')
const logger = require('../lib/logger')(':app:websocket')
const ErrorHandler = require('../lib/error-handler')

module.exports = function () {
  if (process.env.WEBSOCKET_DISABLED === 'true') {
    logger.log('WARNING! WebSocket server is disabled via process.env')
    return
  }

  const App = require('./index') // Get the App object
  const PORT = process.env.WEBSOCKET_PORT || App.config.websocket?.port || 60081
  const PING_INTERVAL = App.config.websocket?.ping_interval || 30000
  const PING_TIMEOUT = App.config.websocket?.ping_timeout || 10000

  // Create WebSocket server
  const wss = new WebSocket.Server({ port: PORT })

  // Track connected agents
  const connectedAgents = new Map()

  // Ping all clients at regular intervals to keep connections alive
  const heartbeat = () => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        logger.log('Client failed to respond to ping, terminating connection')
        return ws.terminate()
      }
      
      ws.isAlive = false
      ws.ping()
    })
  }

  const pingInterval = setInterval(heartbeat, PING_INTERVAL)

  // Clean up the interval when the server closes
  wss.on('close', () => {
    clearInterval(pingInterval)
  })

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress
    logger.log(`Agent connected from ${clientIp}`)
    
    // Mark the connection as alive initially
    ws.isAlive = true
    
    // Set up pong response handler
    ws.on('pong', () => {
      ws.isAlive = true
    })

    // Set up event handlers for this connection
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message)
        logger.log(`Received message from agent: ${clientIp}`, data)
        
        // Process message based on type
        // Add your message handling logic here
        
      } catch (err) {
        logger.error('Error processing message from agent', err)
      }
    })

    ws.on('close', () => {
      logger.log(`Agent disconnected: ${clientIp}`)
      // Clean up any resources for this agent
    })

    ws.on('error', (err) => {
      logger.error(`WebSocket error for agent ${clientIp}:`, err)
      const handler = new ErrorHandler()
      handler.sendExceptionAlert(err)
    })

    // Send initial handshake/welcome message
    ws.send(JSON.stringify({ 
      type: 'welcome',
      timestamp: new Date().toISOString()
    }))
  })

  wss.on('error', (err) => {
    logger.error('WebSocket server error:', err)
    const handler = new ErrorHandler()
    handler.sendExceptionAlert(err)
  })

  logger.log(`WebSocket server for agents started on port ${PORT}`)

  // Store the WebSocket server instance in the App object for access from other modules
  App.websocketServer = wss
} 