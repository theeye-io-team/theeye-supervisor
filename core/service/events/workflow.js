const App = require('../../app')
const logger = require('../../lib/logger')(':events:workflow')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const TopicConstants = require('../../constants/topics')
const StateConstants = require('../../constants/states')
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
        handleWorkflowTaskJobFinishedEvent(payload)
      }
    }

    if (
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
 * A task-job has finished.
 *
 * @param {Event} event entity to process
 * @param {Job} job the job that generates the event
 * @param {Mixed} data event data, this is the job.output
 */
const handleWorkflowTaskJobFinishedEvent = async ({ event, data, job }) => {
  const { workflow_id, workflow_job_id } = job

  // search workflow step by generated event
  const workflow = await App.Models.Workflow.Workflow.findById(workflow_id)
  const workflow_job = await App.Models.Job.Workflow.findById(workflow_job_id)

  if (!workflow) { return }
  if (!workflow_job) { return }

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

  const jobsPromises = []
  const graph = new graphlib.json.read(workflow.graph)
  const nodeV = event.emitter_id.toString()

  const nodes = graph.successors(nodeV)
  if (Array.isArray(nodes) && nodes.length > 0) {
    for (let nodeW of nodes) {
      const edgeLabel = graph.edge(nodeV, nodeW)
      if (edgeLabel === event.name) {
        const payload = { nodeW, job, workflow, workflow_job, argsValues }
        jobsPromises.push(createWorkflowNodeJob(payload))
      }
    }
  }

  // don't wait jobs creation
  // negative or positive (signed) number 
  // calculate the number of active paths based on the number of jobs simultaneously created
  const inc = await updateActivePaths (workflow_job, jobsPromises.length)
  workflow_job.active_paths_counter += inc

  if (workflow_job.active_paths_counter === 0) {
    //
    // WARNING: this counter is neccesary to evaluate simultaneous && paralell jobs.
    // a better solution is required (eg: a specific task to control parallel executed jobs)
    //
    // if jobs.length is greater than 1, we cannot determine the final workflow state
    // 
    // if active_paths_counter doesn't reach cero, the finished event won't trigger
    //
    App.jobDispatcher.finishWorkflowJob(workflow_job, {
      trigger_name: job.trigger_name,
      state: job.state,
      lifecycle: job.lifecycle
    })
  }

  // jobs creation must resolve after calculating the workflow updates.
  // if a job fails to start will trigger an event and will be handled async 
  return Promise.all(jobsPromises)
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

/**
 * @param {Object} payload
 * @prop {Job} payload.job
 * @prop {Object} payload.nodeW
 */
const createWorkflowNodeJob = async ({ workflow, job, nodeW, workflow_job, argsValues }) => {
  const task = await Task.findById(nodeW)
  if (!task) {
    throw new Error(`workflow step ${nodeW} is missing`)
  }

  const { user, dynamic_settings } = await ifTriggeredByJobSettings(job)
  const nodeJob = await createTaskJob({
    workflow_job_id: workflow_job._id,
    order: workflow_job.order,
    user,
    task,
    task_arguments_values: argsValues,
    dynamic_settings,
    workflow,
    origin: JobConstants.ORIGIN_WORKFLOW
  })

  return nodeJob
}

/**
 * there are a few use cases we need to contemplate here:
 *
 * 1. the finished job started a new job and it is the same path that continues executing until reaching the end.
 * (jobs.length === 1)
 *
 * 2. the finished job started two or more simultaneous jobs.
 * (jobs.length > 1)
 *
 * 3. the finished job failed to start a new job and will jump to the end
 * (jobs.length === 1 && jobs.state !== in_progress)
 *
 * 4. the finished job was the last job in the path.
 * (jobs.length === 0)
 *
 * case 1. there is nothing to do.
 * case 2. the active paths must increase in the number of parallel created jobs
 * case 3 and 4. the active paths must decrease by 1.
 */
const updateActivePaths = async (workflow_job, paths) => {

  let inc = 0

  // case 1 and 3.
  if (paths === 1) {
    // nothing
  }
  // case 4. the path reach the end. no more nodes in this path
  else if (paths === 0) {
    inc = -1
  }
  // case 2. new paths created
  else if (paths > 1) {
    inc = (paths - 1) // there is always one active path (the main)
  }

  if (inc !== 0) {
    // update active paths
    await App.Models.Job.Workflow.updateOne(
      { _id: workflow_job._id },
      { $inc: { active_paths_counter: inc } }
    )
  }

  return inc
}
