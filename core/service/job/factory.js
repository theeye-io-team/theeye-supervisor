const App = require('../../app')
const JobModels = require('../../entity/job')
const Script = require('../../entity/file').Script
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const TaskConstants = require('../../constants/task')
const StateConstants = require('../../constants/states')
const ErrorHandler = require('../../lib/error-handler')
const logger = require('../../lib/logger')('service:jobs:factory')
const isDataURL = require('valid-data-url')

const JobsFactory = {
  /**
   * @param Object params
   * @prop Job
   * @prop User
   * @prop Customer
   * @prop Object task_arguments_values
   * @return Promise
   */
  async restart (params) {
    const { job, user, task_arguments_values } = params
    const builder = new JobsBuilderMap[ job.task.type ]({ job })
    return builder.rebuild(user, task_arguments_values)
  },
  /**
   *
   * @param {Task} task task model
   * @param {Object} input
   * @property {Object} input.dynamic_settings
   * @property {User} input.user
   * @property {Customer} input.customer
   * @param {Function} next
   *
   */
  async create (task, input, next) {
    try {
      if ( ! JobsBuilderMap[ task.type ] ) {
        throw new Error(`Invalid or undefined task type ${task.type}`)
      }

      const builder = new JobsBuilderMap[ task.type ]({ task, vars: input })
      const job = await builder.create()
      next(null, job)
    } catch (err) {
      next(err)
    }
  },
  /**
   * @param {Object} input
   * @return {Promise}
   */
  createWorkflow (input) {
    const builder = new WorkflowJob(input)
    return builder.create()
  },
  /**
   *
   * @return {Promise<AgendaJob>}
   *
   */
  createScheduledJob (input) {
    return new Promise( (resolve, reject) => {
      const task = input.task
      const customer = input.customer

      const runDate = Date.now() + (task.grace_time * 1000)
      const data = {
        runDate,
        task,
        customer,
        user: input.user,
        origin: input.origin,
        notify: true
      }

      App.scheduler.scheduleTask(data, (err, agendaJob) => {
        if (err) {
          logger.error('cannot schedule workflow job')
          logger.error(err)

          return reject(err)
        }

        return resolve(agendaJob)
      })
    })
  },
  /**
   *
   * @param {String} argumentsType type and formatter
   * @param {Object[]} argumentsDefinition stored definition
   * @param {Object{}} argumentsValues user provided values
   * @param {Function} next
   *
   */
  prepareTaskArgumentsValues (argumentsType, argumentsDefinition, argumentsValues, next) {
    let errors = new ErrorHandler()
    let filteredArguments = []

    if ( !Array.isArray(argumentsDefinition) || argumentsDefinition.length === 0 ) {
      // no arguments
      return next(null, [])
    }

    argumentsDefinition.forEach((def, index) => {
      let value = null
      let order

      if (Boolean(def)) {
        // is defined
        if (typeof def === 'string') {
          // fixed values. older version compatibility
          order = index
          vlaue = def
        } else if (def.type) {
          order = def.order
          if (def.type === TaskConstants.ARGUMENT_TYPE_FIXED) {
            value = def.value
          } else {
            // arguments payload is required
            let found = searchInputArgumentValueByOrder(argumentsValues, def.order)
            if (found === undefined) {
              errors.required(def.label, null, 'Task argument not found in payload.')
            }

            if (def.type === 'file' && typeof found === 'string' && isDataURL(found)) {
              value = found
            } else {
              if (argumentsType === 'json') {
                value = parseArgumentJson(found)
              } else if (argumentsType === 'text') {
                value = parseArgumentText(found)
              } else {
                value = parseArgumentLegacy(found)
              }
            }
          }
        } else {
          // argument is not a string and does not has a type
          order = index
          errors.invalid(`arg${index}`, def, 'task argument definition error. malkformed')
        }
      }

      filteredArguments[order] = value
    })

    if (errors.hasErrors()) {
      let name = 'InvalidTaskArguments'
      const err = new Error(name)
      err.name = name
      err.statusCode = 400
      err.errors = errors
      return next(err, filteredArguments)
    }

    next(null, filteredArguments)
  }
}

module.exports = JobsFactory

/**
 *
 * @version original
 * @param {Mixed} found
 *
 **/
const parseArgumentLegacy = (found) => {
  let value
  // the argument is not present within the provided request arguments
  if (!found) { // null, empty string, false, 0
    value = found
  } else {
    value = (found.value || found)
    if (typeof value !== 'string') {
      value = JSON.stringify(value)
    }
  }
  return value
}

/**
 *
 * Version enabled when argument is not required or new version.
 * All arguments are treated as JSON strings. 
 * Formatter allows to recontruct the values using an SDK in high level languajes.
 *
 * Arguments content-type: application/json 
 *
 * @version 2021-01-07
 * @param {Mixed} found
 * @return {String} JSON.stringify value
 *
 **/
const parseArgumentJson = (found) => {
  let value
  if (found === undefined) { // was not found in input payload
    return JSON.stringify(undefined)
  }
  if (found === null) { // was found and value is null
    return JSON.stringify(null)
  }
  if (Object.prototype.hasOwnProperty.call(found, 'value')) {
    return JSON.stringify(found.value)
  }
  return JSON.stringify(found) // whatever it is convert to string
}

/**
 *
 * Version enabled when argument is not required or new version.
 * All arguments are treated as text/plan . 
 * Formatter allows to recontruct the values using an SDK in high level languajes.
 *
 * Arguments content-type: text/plain 
 *
 * @version 2021-07-14
 * @param {Mixed} found
 * @return {String} value
 *
 **/
const parseArgumentText = (found) => {
  let value
  if (found === undefined) { // was not found in input payload
    return "undefined"
  }
  if (found === null) { // was found and value is null
    return "null"
  }
  if (Object.prototype.hasOwnProperty.call(found, 'value')) {
    value = found.value
  } else {
    value = found
  }

  if (typeof value !== 'string') {
    return JSON.stringify(found) // whatever it is convert to string
  }
  return value
}

/**
 *
 * @param {Object} input controlled internal input
 * @property {Object} input.vars request/process provided arguments
 * @property {Task} input.task
 * @property {Object} input.taskOptionals
 *
 * @return Promise
 *
 */
//const createJob = (input) => {
//  const { task } = input
//
//  if ( ! JobsBuilderMap[ task.type ] ) {
//    throw new Error(`Invalid or undefined task type ${task.type}`)
//  }
//
//  const builder = new JobsBuilderMap[ task.type ]( input )
//  return builder.create()
//}

const searchInputArgumentValueByOrder = (values, searchOrder) => {
  if (!values || !Array.isArray(values)) { return undefined }

  return values.find((arg, idx) => {
    let order
    if (!arg || !arg.order) {
      order = idx
    } else {
      order = arg.order
    }
    return (order === searchOrder)
  })
}

const hasDynamicSettings = (dynamics) => {
  return (
    dynamics &&
    typeof dynamics == 'object' &&
    Object.keys(dynamics).length > 0
  )
}

const ensureMembersAccess = (job, members) => {
  // every job of this workflow must be visible to the assigned/owner member
  const users = membersToUsers(members)

  // every job of this workflow must be visible to the assigned members
  for (let user of users) {
    if (!job.acl.includes(user.email)) {
      job.acl.push(user.email)
    }
  }
}

const membersToUsers = members => members.map(mem => mem.user)

const hasParticipants = users => (Array.isArray(users) && users.length > 0)

const updateAssignee = (job, members) => {

  ensureMembersAccess(job, members)

  const users = membersToUsers(members)
  // users interaction version 2
  job.assigned_users = users.map(user => user.id)

  // if job.user_inputs is true this will be the list of members.
  // also used by approval tasks
  job.user_inputs_members = members.map(mem => mem.id)
}

const ensureObserversAccess = ({ job, empty_viewers, acl, acl_dynamic = false }) => {
  if (
    empty_viewers === true ||
    acl_dynamic === true // @TODO remove
  ) {
    job.acl = []
  } else {
    job.acl = acl
  }
}

class WorkflowJob {
  constructor (input) {
    this.input = input
  }

  async create () {
    const input = this.input
    const { workflow, user, customer } = input

    const wJob = new JobModels.Workflow(
      Object.assign({},
        input, /* VARIABLE parameters, depends on the CONTEXT */
        {
          /* FIXED parameters */
          workflow_id: workflow._id,
          workflow: workflow._id,
          name: workflow.name,
          allows_dynamic_settings: workflow.allows_dynamic_settings,
          customer,
          customer_id: customer._id.toString(),
          customer_name: customer.name,
          user_id: (user?.id)
          //task_arguments_values: null
        })
    )

    ensureObserversAccess({
      acl: workflow.acl,
      job: wJob,
      empty_viewers: (input.empty_viewers || workflow.empty_viewers),
      acl_dynamic: workflow.acl_dynamic
    })

    //
    // set participants (assignee, owner, observers) at workflow level
    //
    if (hasParticipants(input.assignee)) {
      updateAssignee(wJob, input.assignee)
    } else {
      //
      // Automatically determined by the execution context
      //
      if (hasParticipants(input.owners)) {
        ensureMembersAccess(wJob, input.owners)
      }

      // default users interaction
      //wJob.assigned_users = users.map(user => user.id) // the assigned user is the owner.
      wJob.user_inputs_members = workflow.user_inputs_members
    }

    await wJob.save()

    return wJob
  }
}

class AbstractJob {
  constructor (input) {
    this.input = input
    this.task = input.task
    this.vars = input.vars
    this.workflowJob = null
    this.job = null
  }

  /**
   * @return Promise
   */
  async create () {
    try {
      await this.getWorkflow()
      await this.setupJobBasicProperties()
      await this.build()
      await this.verifyArguments()

      // it is trying to change the job predefined behaviour
      if (hasDynamicSettings(this.vars.dynamic_settings)) {
        if (this.job.allows_dynamic_settings !== false) {
          // backward compatibility, if the property was not properly set
          await this.setDynamicProperties()
        } else {
          const job = this.job
          const workflowJob = this.workflowJob
          // notify
          App.notifications.sendEmailNotification({
            customer_name: this.job.customer_name,
            subject: 'Dynamic Settings Forbidden',
            to: App.config.mailer.support.join(','),
            content: `
              <div>Job information</div>
              <table>
                <tr>
                  <td>Job ID</td>
                  <td>${job._id}</td>
                </tr>
                <tr>
                  <td>Name</td>
                  <td>${job.name}</td>
                </tr>
                <tr>
                  <td>Task ID</td>
                  <td>${job.task_id}</td>
                </tr>
                <tr>
                  <td>WF ID</td>
                  <td>${job.workflow_id}</td>
                </tr>
                <tr>
                  <td>WF Job ID</td>
                  <td>${job.workflow_job_id}</td>
                </tr>
                <tr>
                  <td>WF Name</td>
                  <td>${(workflowJob && workflowJob.name)}</td>
                </tr>
              </table>
            `
          })
        }
      }

      await this.saveJob()
    } catch (err) {
      logger.error(err)
      await this.terminateBuild(err)
    }
    return this.job
  }

  async getWorkflow () {
    const { task, vars, job } = this
    if (task.workflow_id) {
      if (!vars.workflow_job_id) {
        logger.error('%o', task)
        throw new Error('missing workflow job')
      }

      // verify workflows exists
      const workflowJob = await App.Models.Job.Workflow.findById(vars.workflow_job_id)
      if (!workflowJob) {
        throw new Error('Internal Error. Workflow job not found')
      }
      this.workflowJob = workflowJob
    }
  }

  /*
   * create Job and terminate. cannot execute with errors
   */
  async terminateBuild (err) {
    const job = this.job
    job.state = StateConstants.ERROR
    job.lifecycle = LifecycleConstants.TERMINATED
    job.result = { log: JSON.stringify(err.message) }
    job.output = JSON.stringify(err.message)
    await job.save()
  }

  async build () {
  }

  async setDynamicProperties () {
    const job = this.job
    const dynamicSettings = [
      'user_inputs',
      'user_inputs_members'
    ]

    const dynamic = this.vars.dynamic_settings
    if (dynamic) {
      for (let prop of dynamicSettings) {
        if (dynamic[prop]) {
          let value = dynamic[prop]
          if (prop === 'user_inputs_members') {
            if (!Array.isArray(value)) {
              throw new Error('Invalid members format. Array required')
            }
            if (value.length === 0) {
              throw new Error('Need at least one member')
            }

            const members = await App.gateway.member.fetch(value, { customer_id: job.customer_id })
            if (!members || members.length === 0) {
              throw new Error('Invalid members')
            }

            job['user_inputs_members'] = members.map(u => u.id)
          } else {
            job[prop] = value
          }
        }
      }
    }
  }

  async verifyArguments () {
    const { job, task, vars } = this

    if (
      vars.origin !== JobConstants.ORIGIN_USER &&
      job.user_inputs === true
    ) {
      // we don't care about automatic arguments,
      // a user must enter the arguments values
      job.lifecycle = LifecycleConstants.ONHOLD
      job.task_arguments_values = []
    } else {
      const argsDefinition = task.task_arguments
      const inputArgsValues = vars.task_arguments_values

      try {
        const values = await new Promise( (resolve, reject) => {
          JobsFactory.prepareTaskArgumentsValues(
            task.arguments_type,
            argsDefinition,
            inputArgsValues,
            (err, values) => {
              if (err) {
                logger.log('%o', err)
                err.statusCode = 400 // input error
                return reject(err)
              }

              resolve(values)
            }
          )
        })
        job.task_arguments_values = values
      } catch (err) {
        if (TaskConstants.TYPE_NOTIFICATION !== task.type) {
          job.task_arguments_values = inputArgsValues
          await this.terminateBuild(err)
        }
      }
    }
  }

  async saveJob () {
    const job = this.job
    await job.save()

    this.task.execution_count += 1
    await this.task.save()
    return this
  }

  async setupJobBasicProperties () {
    const { task, vars, job } = this

    // copy embedded task object
    // pre-defined settings
    job.task = Object.assign({}, task.toObject(), {
      customer: null,
      host: null
    }) // >>> add .id  / embedded

    job.logging = (task.logging || false)
    job.task_id = task._id
    job.host_id = task.host_id
    job.host = task.host_id
    job.name = task.name
    job.allows_dynamic_settings = task.allows_dynamic_settings
    job.show_result = task.show_result
    //job.handle_errors = task.handle_errors

    job.customer = vars.customer._id
    job.customer_id = vars.customer._id
    job.customer_name = vars.customer.name

    // initialize dynamic settings
    job.state = (vars.state || StateConstants.IN_PROGRESS)
    job.lifecycle = (vars.lifecycle || LifecycleConstants.READY)
    job.user_id = (vars.user && vars.user.id) // the user that executes the task/wokflow
    job.notify = vars.notify || null
    job.origin = vars.origin || null
    job.triggered_by = (vars.event && vars.event._id) || null

    if (this.workflowJob) {
      // replace job & task properties, with global workflow properties
      this.setupJobWorkflowProperties()
    }

    this.setupParticipantsInteraction()

    return job
  }

  setupJobWorkflowProperties () {
    const { task, job, workflowJob } = this
    if (workflowJob) {
      job.workflow = task.workflow_id
      job.workflow_id = task.workflow_id

      // workflow job instance
      job.workflow_job = workflowJob.id
      job.workflow_job_id = workflowJob.id

      // reject dynamic settings when the workflow global settings reject it
      if (workflowJob.allows_dynamic_settings === false) {
        job.allows_dynamic_settings = workflowJob.allows_dynamic_settings
      }
    }
  }

  setupParticipantsInteraction () {
    const { task, vars, job, workflowJob } = this

    // requires users interaction
    job.user_inputs = (vars.user_inputs || task.user_inputs)

    // belongs to a workflow. interaction depends on the workflow settings.
    if (workflowJob) {
      job.acl = workflowJob.acl.toObject()
      job.assigned_users = workflowJob.assigned_users.toObject()
      job.user_inputs_members = workflowJob.user_inputs_members.toObject()
    } else {
      // single tasks execution has its own settings
      // use default acl
      ensureObserversAccess({
        acl: (vars.acl || task.acl.toObject()),
        job,
        empty_viewers: task.empty_viewers
      })

      if (hasParticipants(vars.assignee)) {
        updateAssignee(job, vars.assignee)
      } else {
        // pre-defined user inputs, if any
        Object.assign(job, {
          assigned_users: (vars.assigned_users || task.assigned_users.toObject()),
          user_inputs_members: (vars.user_inputs_members || task.user_inputs_members.toObject())
        })
      }
    }
  }
}

class ApprovalJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Approval()
  }

  async build () {
    /** approval job is created onhold , waiting approvers decision **/
    const { job, task } = this
    job.lifecycle = LifecycleConstants.ONHOLD
    job.approvals_target = task.approvals_target

    // set default properties
    job.success_label = task.success_label
    job.failure_label = task.failure_label
    job.cancel_label = task.cancel_label
    job.ignore_label = task.ignore_label

    if (job.approvals_target === TaskConstants.APPROVALS_TARGET_INITIATOR) {
      job.approvers = [ job.user_id ]
    } else if (job.approvals_target === TaskConstants.APPROVALS_TARGET_ASSIGNEES) {
      job.approvers = job.assigned_users
    } else if (!job.approvals_target || job.approvals_target === TaskConstants.APPROVALS_TARGET_FIXED) {
      job.approvers = task.approvers
    }
  }

  async setDynamicProperties () {
    const job = this.job
    const dynamicSettings = [
      'approvers',
      'success_label',
      'failure_label',
      'cancel_label',
      'ignore_label'
    ]

    const dynamic = this.vars.dynamic_settings
    if (dynamic) {
      const settings = dynamic[ TaskConstants.TYPE_APPROVAL ]
      if (settings) {
        for (let prop of dynamicSettings) {
          if (settings[prop]) {
            let value = settings[prop]
            if (prop === 'approvers') {
              // should validate
              if (!Array.isArray(value)) {
                throw new Error('Invalid approvers format. Array required')
              }
              if (value.length === 0) {
                throw new Error('Invalid approvers. Need at least one')
              }

              const users = await App.gateway.user.fetch(value, { customer_id: job.customer_id })
              // if not found users , leave undefined
              if (users.length === 0) {
                value = undefined
                throw new Error(`Cannot determine approvers ${JSON.stringify(settings.approvers)}`)
              }

              job['approvers'] = users.map(u => u.id)
              job.approvals_target = TaskConstants.APPROVALS_TARGET_ASSIGNEES
            } else {
              job[prop] = value
            }
          }
        }
      }
    }
  }
}

class ScriptJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = (input.job || new JobModels.Script())
  }

  async rebuild (user, inputArgs) {
    const job = this.job

    const [ task, script ] = await Promise.all([
      App.Models.Task.ScriptTask.findById(job.task_id),
      App.Models.File.Script.findById(job.script_id)
    ])

    const argsValues = await new Promise( (resolve, reject) => {
      JobsFactory.prepareTaskArgumentsValues(
        task.arguments_type,
        task.task_arguments,
        inputArgs,
        (err, args) => {
          if (err) {
            logger.log('%o', err)
            err.statusCode = 400 // input error
            return reject(err)
          }

          resolve(args)
        })
    })

    job.env = Object.assign({}, job.env, {
      THEEYE_JOB_USER: JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username,
      })
    })

    // replace script with updated version
    job.script = script.toObject()
    job.script_id = script._id
    job.script_runas = task.script_runas
    job.script_arguments = argsValues
    job.task_arguments_values = argsValues
    job.timeout = task.timeout
    job.lifecycle = LifecycleConstants.READY
    job.state = StateConstants.IN_PROGRESS

    await job.save()
  }

  async build () {
    const job = this.job
    const { task, vars } = this
    const user = (vars.user || {})
    const script = await Script.findById(task.script_id)

    if (!script) {
      const msg = 'cannot create job. script is no longer available'
      logger.error(msg)

      const Err = new Error(msg)
      Err.statusCode = 404
      throw Err
    }

    job.script = script.toObject() // >>> add .id  / embedded
    job.script_id = script._id
    job.script_arguments = job.task_arguments_values
    job.script_runas = task.script_runas
    job.timeout = task.timeout
    job.env = Object.assign({
      THEEYE_JOB: JSON.stringify({
        id: job._id,
        task_id: task._id
      }),
      THEEYE_JOB_USER: JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username
      }),
      THEEYE_JOB_WORKFLOW: JSON.stringify({
        job_id: job.workflow_job_id,
        id: job.workflow_id
      }),
      THEEYE_ORGANIZATION_NAME: JSON.stringify(vars.customer.name),
      THEEYE_API_URL: JSON.stringify(App.config.system.base_url)
    }, task.env)
  }
}

class ScraperJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Scraper()
  }

  async build () {
    const job = this.job
    job.timeout = this.task.timeout
  }
}

class DummyJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Dummy()
  }
}

class NotificationJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Notification()
  }
}

const JobsBuilderMap = {}
JobsBuilderMap[ TaskConstants.TYPE_SCRIPT ] = ScriptJob
JobsBuilderMap[ TaskConstants.TYPE_SCRAPER ] = ScraperJob
JobsBuilderMap[ TaskConstants.TYPE_APPROVAL ] = ApprovalJob
JobsBuilderMap[ TaskConstants.TYPE_DUMMY ] = DummyJob
JobsBuilderMap[ TaskConstants.TYPE_NOTIFICATION ] = NotificationJob
JobsBuilderMap[ TaskConstants.TYPE_WORKFLOW ] = WorkflowJob
