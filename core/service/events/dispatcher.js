
const EventEmitter = require('events').EventEmitter
const logger = require('../../lib/logger')(':events:dispatcher')
const _prefix = 'ID_'
const _callbacks = []

let _lastID = 1

class Dispatcher extends EventEmitter {

  dispatch (payload) {
    if (!Array.isArray(payload.data)) {
      logger.error(`WARNING! array expected but ${typeof payload.data} was received instead`)
    }

    logger.log('dispatching event %o', payload)
    for (let idx in _callbacks) {
      _callbacks[idx](payload)
    }
  }

  register (callback) {
    const id = _prefix + _lastID++
    _callbacks[id] = callback
    return id
  }

}

module.exports = Dispatcher
