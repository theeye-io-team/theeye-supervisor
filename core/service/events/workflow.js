const App = require('../../app')
const logger = require('../../lib/logger')(':events:workflow')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')
const graphlib = require('graphlib')

module.exports = function (payload) {
  if (payload.topic === TopicConstants.workflow.execution) {
    // a task belonging to a workflow has finished
    handleWorkflowEvent(payload)
  } else if (
    payload.topic === TopicConstants.task.execution ||
    payload.topic === TopicConstants.monitor.state ||
    payload.topic === TopicConstants.webhook.triggered ||
    payload.topic === TopicConstants.workflow.execution
  ) {
    // workflow trigger has occur
    triggerWorkflowByEvent(payload)
  }
}

/**
 * @param {Event} event entity to process
 * @param {Object} data event extra data generated
 */
const handleWorkflowEvent = ({ event, workflow_id, data }) => {
  // search workflow step by generated event
  let query = Workflow.findById(workflow_id)
  query.exec((err, workflow) => {
    if (err) {
      logger.error(err)
      return
    }

    if (!workflow) { return }

    executeWorkflowStep(workflow, event, data)
  })
}

const executeWorkflowStep = (workflow, event, data) => {
  var graph = new graphlib.json.read(workflow.graph)
  var nodes = graph.successors(event._id.toString()) // should return tasks nodes
  if (!nodes) return
  if (nodes.length === 0) return

  Task
    .find({ '_id': { $in: nodes } })
    .exec((err, tasks) => {
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
          origin: JobConstants.ORIGIN_WORKFLOW
        })
      }
    })
}

const triggerWorkflowByEvent = ({ event, data }) => {
  let query = Workflow.find({ triggers: event._id })
  query.exec((err, workflows) => {
    if (err) {
      logger.error(err)
      return
    }
    if (workflows.length===0) return
    for (var i=0; i<workflows.length; i++) {
      executeFirstWorkflowTask(workflows[i], event, data)
    }
  })
}

const executeFirstWorkflowTask = (workflow, event, data) => {
  workflow.start_task = workflow.start_task_id
  workflow.populate([
    { path: 'start_task' }
  ], err => {
    if (err) {
      logger.error(err)
      return
    }

    if (!workflow.start_task) {
      logger.error('could not populate workflow start_task %s', workflow.start_task_id)
      return
    }

    createJob({
      task: workflow.start_task,
      user: App.user,
      event,
      event_data: data,
      origin: JobConstants.ORIGIN_TRIGGER_BY
    })
  })
}
