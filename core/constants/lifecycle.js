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
// FINISHED LIFECYCLE
const FINISHED = 'finished'
const TERMINATED = 'terminated'
const CANCELED = 'canceled'
const EXPIRED = 'expired'
const COMPLETED = 'completed'

exports.READY = READY
exports.ASSIGNED = ASSIGNED
exports.ONHOLD = ONHOLD
exports.FINISHED = FINISHED
exports.TERMINATED = TERMINATED
exports.CANCELED = CANCELED
exports.EXPIRED = EXPIRED
exports.COMPLETED = COMPLETED

exports.VALUES = [
  READY,
  ASSIGNED,
  FINISHED,
  TERMINATED,
  CANCELED,
  EXPIRED,
  COMPLETED
]
