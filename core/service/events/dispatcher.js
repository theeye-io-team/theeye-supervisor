'use strict';

const EventEmitter = require('events').EventEmitter

const logger = require('../../lib/logger')(':events:dispatcher')

const _prefix = 'ID_'
const _callbacks = []
var _lastID = 1

class Dispatcher extends EventEmitter {

	dispatch (payload) {
    logger.log('dispatching event %o', payload)
		for (var idx in _callbacks) {
      _callbacks[idx](payload)
		}
	}

	register (callback) {
		var id = _prefix + _lastID++
		_callbacks[id] = callback
		return id
	}
}

module.exports = Dispatcher

