/**
 *
 * do you have a better idea ?
 *
 * https://en.wikipedia.org/wiki/Task_management
 *
 **/
// IN PROGRESS LIFECYCLE
const READY = 'ready'
const ASSIGNED = 'assigned'
const ONHOLD = 'onhold'
const SYNCING = 'syncing'
const LOCKED = 'locked'

// FINISHED LIFECYCLE
const FINISHED = 'finished'
const TERMINATED = 'terminated'
const CANCELED = 'canceled'
const EXPIRED = 'expired'
const COMPLETED = 'completed'

exports.READY = READY
exports.ASSIGNED = ASSIGNED
exports.ONHOLD = ONHOLD
exports.SYNCING = SYNCING
exports.LOCKED = LOCKED
exports.FINISHED = FINISHED
exports.TERMINATED = TERMINATED
exports.CANCELED = CANCELED
exports.EXPIRED = EXPIRED
exports.COMPLETED = COMPLETED

exports.VALUES = [
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
