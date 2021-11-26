const App = require('../../app')
const logger = require('../../lib/logger')(':events:workflow')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createJob = require('./create-job')
const graphlib = require('graphlib')
const ifTriggeredByJobSettings = require('./triggered-by-job-settings')

/**
 *
 * @param {Object} payload
 * @property {String} payload.topic
 * @property {Event} payload.event entity to process
 * @property {Object} payload.data event data
 *
 */
module.exports = async function (payload) {
  try {
    if (payload.topic === TopicConstants.workflow.execution) {
      if (payload.job.workflow_job_id) {
        // a task belonging to a workflow has finished
        logger.log('This is a workflow event')
        handleWorkflowEvent(payload)
      }
    }

    if (
      payload.topic === TopicConstants.task.execution ||
      payload.topic === TopicConstants.monitor.state ||
      payload.topic === TopicConstants.webhook.triggered ||
      payload.topic === TopicConstants.workflow.execution // a task inside a workflow can trigger tasks outside the workflow
    ) {
      // workflow trigger has occur
      triggerWorkflowByEvent(payload)
    }
  } catch (err) {
    logger.error(err)
  }
}

/**
 * @param {Event} event entity to process
 * @param {Job} job the job that generates the event
 * @param {Mixed} data event data, this is the job.output
 */
const handleWorkflowEvent = async ({ event, data, job }) => {
  const { workflow_id, workflow_job_id } = job
  // search workflow step by generated event
  const workflow = await Workflow.findById(workflow_id)
  if (!workflow) { return }

  const execution = (
    workflow?.version === 2 ?
    executeWorkflowStepVersion2 :
    executeWorkflowStep
  )

  return execution(workflow, workflow_job_id, event, data, job)
}

/**
 *
 * @return {Promise}
 *
 */
const executeWorkflowStep = async (workflow, workflow_job_id, event, argsValues, job) => {
  if (!event || !event._id) {
    return
  }

  const graph = new graphlib.json.read(workflow.graph)
  const nodes = graph.successors(event._id.toString()) // should return tasks nodes
  if (!nodes) { return }
  if (nodes.length === 0) { return }

  logger.log('workflow next step is %j', nodes)

  const tasks = await Task.find({ '_id': { $in: nodes } })
  if (tasks.length == 0) {
    logger.error('workflow steps not found %j', nodes)
    return
  }

  const { user, dynamic_settings } = ifTriggeredByJobSettings(job)

  const promises = []
  for (let i = 0; i < tasks.length; i++) {
    const createPromise = createJob({
      user,
      task: tasks[i],
      task_arguments_values: argsValues,
      dynamic_settings,
      workflow,
      workflow_job_id,
      origin: JobConstants.ORIGIN_WORKFLOW
    })

    createPromise.catch(err => { return err })
    promises.push(createPromise)
  }

  return Promise.all(promises)
}

/**
 *
 * @return {Promise}
 *
 */
const executeWorkflowStepVersion2 = (workflow, workflow_job_id, event, argsValues, job) => {

  if (!event || !event._id) {
    return
  }

  const graph = new graphlib.json.read(workflow.graph)
  const nodeV = event.emitter_id.toString()

  const nodes = graph.successors(nodeV)
  if (!nodes || (Array.isArray(nodes) && nodes.length === 0)) {
    return
  }

  const promises = []
  for (let nodeW of nodes) {
    const edgeLabel = graph.edge(nodeV, nodeW)
    if (edgeLabel === event.name) {
      promises.push(
        Task.findById(nodeW)
        .then(task => {
          if (!task) {
            throw new Error(`workflow step ${nodeW} is missing`)
          }

          const { user, dynamic_settings } = ifTriggeredByJobSettings(job)
          const createPromise = createJob({
            user,
            task,
            task_arguments_values: argsValues,
            dynamic_settings,
            workflow,
            workflow_job_id,
            origin: JobConstants.ORIGIN_WORKFLOW
          })

          createPromise.catch(err => { return err })
          return createPromise
        })
      )
    }
  }

  return Promise.all(promises)
}

/**
 * @param {Event} event entity to process
 * @param {Job} job the job that generates the event
 * @param {Mixed} data event data, this is the job.output
 */
const triggerWorkflowByEvent = async ({ event, data, job }) => {
  if (!event || !event._id) {
    return
  }

  const workflows = await Workflow.find({ triggers: event._id })
  if (workflows.length===0) { return }

  const promises = []
  for (var i=0; i<workflows.length; i++) {
    const execPromise = executeWorkflow(workflows[i], data, job, event)
    execPromise.catch(err => { return err })
    promises.push(execPromise)
  }
  return Promise.all(promises)
}

const executeWorkflow = async (workflow, argsValues, job, event) => {
  await workflow.populate([{ path: 'customer' }]).execPopulate()

  if (!workflow.customer) {
    return logger.error('FATAL. Workflow %s does not has a customer', workflow._id)
  }

  const { user, dynamic_settings } = ifTriggeredByJobSettings(job)

  return App.jobDispatcher.createByWorkflow({
    customer: workflow.customer,
    task_arguments_values: argsValues,
    dynamic_settings,
    workflow,
    event,
    user,
    notify: true,
    origin: JobConstants.ORIGIN_TRIGGER_BY
  })
}
