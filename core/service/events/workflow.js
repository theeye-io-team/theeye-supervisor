const App = require('../../app')
const logger = require('../../lib/logger')(':events:workflow')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const JobConstants = require('../../constants/jobs')
const createTaskJob = require('./create-job')
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
    if (payload.topic === TopicConstants.job.finished) {
      if (payload.job.workflow_job_id) {
        // a task-job belonging to a workflow finished
        logger.log('This is a workflow job event')
        handleWorkflowTaskJobEvent(payload)
      }
    } else if (
      payload.topic === TopicConstants.monitor.state ||
      payload.topic === TopicConstants.webhook.triggered ||
      payload.topic === TopicConstants.job.finished
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
const handleWorkflowTaskJobEvent = async ({ event, data, job }) => {
  const { workflow_id, workflow_job_id } = job
  // search workflow step by generated event
  const workflow = await App.Models.Workflow.Workflow.findById(workflow_id)
  const workflow_job = await App.Models.Job.Workflow.findById(workflow_job_id)

  if (!workflow) { return }
  if (!workflow_job) { return }

  if (!isNaN(workflow_job.active_jobs_counter)) {
    // reduce on job finished
    await App.Models.Job.Workflow.updateOne(
      { _id: workflow_job._id },
      { $inc: { active_jobs_counter: -1 } }
    )

    workflow_job.active_jobs_counter -= 1
  }

  const executionFn = (
    workflow?.version === 2 ?
    executeWorkflowStepVersion2 :
    executeWorkflowStep
  )

  return executionFn(workflow, workflow_job, event, data, job)
}

/**
 *
 * @return {Promise}
 *
 */
const executeWorkflowStep = async (
  workflow,
  workflow_job,
  event,
  argsValues,
  job
) => {
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

  const { user, dynamic_settings } = await ifTriggeredByJobSettings(job)

  const promises = []
  for (let i = 0; i < tasks.length; i++) {
    const createPromise = createTaskJob({
      order: workflow_job.order,
      user,
      task: tasks[i],
      task_arguments_values: argsValues,
      dynamic_settings,
      workflow,
      workflow_job_id: workflow_job._id,
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
const executeWorkflowStepVersion2 = async (
  workflow,
  workflow_job,
  event,
  argsValues,
  job
) => {
  if (!event) { return }

  const promises = []
  const graph = new graphlib.json.read(workflow.graph)
  const nodeV = event.emitter_id.toString()

  const nodes = graph.successors(nodeV)
  if (Array.isArray(nodes) && nodes.length > 0) {
    for (let nodeW of nodes) {
      const edgeLabel = graph.edge(nodeV, nodeW)
      if (edgeLabel === event.name) {
        const jobPromise = Task
          .findById(nodeW)
          .then(async (task) => {
            if (!task) {
              throw new Error(`workflow step ${nodeW} is missing`)
            }

            const { user, dynamic_settings } = await ifTriggeredByJobSettings(job)
            return createTaskJob({
              order: workflow_job.order,
              user,
              task,
              task_arguments_values: argsValues,
              dynamic_settings,
              workflow,
              workflow_job_id: workflow_job._id,
              origin: JobConstants.ORIGIN_WORKFLOW
            })
          })
          .then(job => {
            if (isNaN(workflow_job.active_jobs_counter)) {
              // not a number. cannot be updated. older jobs, error..
              return null
            }

            // increase
            workflow_job.active_jobs_counter += 1
            return App.Models.Job.Workflow.updateOne(
              { _id: workflow_job._id },
              { $inc: { active_jobs_counter: 1 } }
            )
          }).catch(err => { return err })

        promises.push(jobPromise)
      }
    }
  }

  await Promise.all(promises)

  if (workflow_job.active_jobs_counter === 0) {
    //
    // WARNING: this counter is neccesary to evaluate simultaneous && paralell jobs. a better solution is required (a specific task to control parallel executed jobs)
    // 
    // if counter doesn't reach cero, the finished event won't trigger
    App.jobDispatcher.finishWorkflowJob(workflow_job, {
      trigger_name: job.trigger_name,
      state: job.state,
      lifecycle: job.lifecycle
    })
  }
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

  const { user, dynamic_settings } = await ifTriggeredByJobSettings(job)

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
