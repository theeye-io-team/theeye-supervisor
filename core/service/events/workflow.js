const App = require('../../app')
const logger = require('../../lib/logger')(':events:workflow')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')
const graphlib = require('graphlib')

/**
 *
 * @param {Object} payload
 * @property {String} payload.topic
 * @property {Event} payload.event entity to process
 * @property {Object} payload.output event output
 * @property {String} payload.workflow_id
 * @property {String} payload.workflow_job_id
 *
 */
module.exports = function (payload) {
  if (payload.topic === TopicConstants.workflow.execution) {
    // a task belonging to a workflow has finished
    handleWorkflowEvent(payload)
  } else if (
    payload.topic === TopicConstants.task.execution ||
    payload.topic === TopicConstants.monitor.state ||
    payload.topic === TopicConstants.webhook.triggered
    //payload.topic === TopicConstants.workflow.execution // not yet
  ) {
    // workflow trigger has occur
    triggerWorkflowByEvent(payload)
  }
}

/**
 * @param {Event} event entity to process
 * @param {String} workflow_id
 * @param {String} workflow_job_id
 * @param {Mixed} output event output
 */
const handleWorkflowEvent = ({ event, workflow_id, workflow_job_id, output }) => {
  // search workflow step by generated event
  let query = Workflow.findById(workflow_id)
  query.exec((err, workflow) => {
    if (err) {
      logger.error(err)
      return
    }

    if (!workflow) { return }

    executeWorkflowStep(workflow, workflow_job_id, event, output)
  })
}

const executeWorkflowStep = (workflow, workflow_job_id, event, argsValues) => {
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
          task: tasks[i],
          task_arguments_values: argsValues,
          workflow_job_id,
          origin: JobConstants.ORIGIN_WORKFLOW
        })
      }
    })
}

/**
 * @param {Event} event entity to process
 * @param {Mixed} output event output
 */
const triggerWorkflowByEvent = ({ event, output }) => {
  let query = Workflow.find({ triggers: event._id })
  query.exec((err, workflows) => {
    if (err) {
      logger.error(err)
      return
    }
    if (workflows.length===0) { return }

    for (var i=0; i<workflows.length; i++) {
      executeWorkflow(workflows[i], output)
    }
  })
}

const executeWorkflow = (workflow, argsValues) => {
  workflow.populate([{ path: 'customer' }], (err) => {
    if (err) {
      return logger.error(err)
    }

    if (!workflow.customer) {
      return logger.error('FATAL. Workflow %s does not has a customer', workflow._id)
    }

    App.jobDispatcher.createByWorkflow({
      workflow,
      customer: workflow.customer,
      task_arguments_values: argsValues,
      user: App.user,
      notify: true,
      origin: JobConstants.ORIGIN_TRIGGER_BY
    })
  })
}
