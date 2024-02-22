const App = require('../../app')
const logger = require('../../lib/logger')(':events:task-trigger-by')
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')
const ifTriggeredByJobSettings = require('./triggered-by-job-settings')

/**
 *
 * @param {Object} payload
 * @property {String} payload.topic
 * @property {Event} payload.event entity to process
 * @property {Object} payload.data event data
 * @property {Object} payload.job the job that generates the event
 *
 */
module.exports = async function (payload) {
  try {
    // task executed
    if (payload.topic === TopicConstants.job.crud) {
      await handleEvent(payload)
    }
  } catch (err) {
    logger.error(err)
  }
}

const handleEvent = async ({ event, data, job }) => {
  if (job._type === JobConstants.DUMMY_TYPE) {
    if (job.lifecycle !== LifecycleConstants.ONHOLD) {
      await App.jobDispatcher.finishDummyJob(job, data)
    }
  }
  else if (job._type === JobConstants.NOTIFICATION_TYPE) {
    await App.jobDispatcher.finishNotificationJob(job, data)
  }
}
