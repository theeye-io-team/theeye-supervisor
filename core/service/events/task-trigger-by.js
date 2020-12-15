const App = require('../../app')
const logger = require('../../lib/logger')(':events:task-trigger-by')
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')

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
    // a task completed its execution and triggered an event
    // or a monitor has changed its state
    if (
      payload.topic === TopicConstants.task.execution ||
      payload.topic === TopicConstants.monitor.state ||
      payload.topic === TopicConstants.webhook.triggered ||
      payload.topic === TopicConstants.workflow.execution
    ) {
      await triggeredTaskByEvent(payload)
    }
  } catch (err) {
    logger.error(err)
  }
}

/**
 * @param {Event} event entity to process
 * @param {Mixed} data event data, this is the job.output
 * @param {Job} job the job that generates the event
 */
const triggeredTaskByEvent = async ({ event, data, job }) => {
  // search all task triggered by the event, not included in workflows
  const tasks = await Task.find({
    triggers: event._id,
    $or: [
      { workflow_id: { $eq: null } },
      { workflow_id: { $exists: false } }
    ]
  })

  if (tasks.length == 0) { return }

  // if the event is emitted by a job
  let task_optionals
  if (job) {
    if (job.result && job.result.next) {
      task_optionals = job.result.next
    }
  }

  const promises = []
  for (var i=0; i<tasks.length; i++) {
    const createPromise = createJob({
      event,
      user: App.user,
      task: tasks[i],
      task_arguments_values: data,
      task_optionals,
      origin: JobConstants.ORIGIN_TRIGGER_BY
    })
    createPromise.catch(err => { return err })
    promises.push(createPromise)
  }

  return Promise.all(promises)
}
