const logger = require('../../lib/logger')(':events:task-trigger-by')
const App = require('../../app')
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')

module.exports = function (payload) {
  // a task completed its execution and triggered an event
  // or a monitor has changed its state
  if (
    payload.topic === TopicConstants.task.execution ||
    payload.topic === TopicConstants.monitor.state ||
    payload.topic === TopicConstants.webhook.triggered ||
    payload.topic === TopicConstants.workflow.execution
  ) {
    runTriggeredTaskByEvent(payload)
  }
}

/**
 * @param {Event} event entity to process
 * @param {Object} data event extra data generated
 */
const runTriggeredTaskByEvent = ({ event, data }) => {
  // search all task triggered by the event
  let query = Task.find({
    triggers: event._id,
    $or: [
      { workflow_id: { $eq: null } },
      { workflow_id: { $exists: false } }
    ]
  })

  query.exec((err, tasks) => {
    if (err) {
      logger.error(err)
      return
    }

    if (tasks.length == 0) { return }

    for (var i=0; i<tasks.length; i++) {
      createJob({
        user: App.user,
        event,
        event_data: data,
        task: tasks[i],
        origin: JobConstants.ORIGIN_TRIGGER_BY
      })
    }
  })
}
