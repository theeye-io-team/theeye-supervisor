/**
 *
 * do you have a better idea ?
 *
 * https://en.wikipedia.org/wiki/Task_management
 *
 **/
// IN PROGRESS LIFECYCLE
const ASSIGNED = 'assigned'
const LOCKED = 'locked'
const ONHOLD = 'onhold'
const READY = 'ready'
const SYNCING = 'syncing'
const STARTED = 'started'

// FINISHED LIFECYCLE
const CANCELED = 'canceled'
const COMPLETED = 'completed'
const EXPIRED = 'expired'
const FINISHED = 'finished'
const TERMINATED = 'terminated'

exports.ASSIGNED = ASSIGNED
exports.CANCELED = CANCELED
exports.COMPLETED = COMPLETED
exports.EXPIRED = EXPIRED
exports.FINISHED = FINISHED
exports.LOCKED = LOCKED
exports.ONHOLD = ONHOLD
exports.STARTED = STARTED
exports.READY = READY
exports.SYNCING = SYNCING
exports.TERMINATED = TERMINATED

exports.VALUES = [
  STARTED,
  READY,
  ASSIGNED,
  ONHOLD,
  SYNCING,
  LOCKED,
  FINISHED,
  TERMINATED,
  CANCELED,
  EXPIRED,
  COMPLETED
]
