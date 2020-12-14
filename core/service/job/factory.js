const App = require('../../app')
const JobModels = require('../../entity/job')
const Script = require('../../entity/file').Script
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const TaskConstants = require('../../constants/task')
const StateConstants = require('../../constants/states')
const ErrorHandler = require('../../lib/error-handler')
const logger = require('../../lib/logger')('service:jobs:factory')

const JobsFactory = {
  /**
   *
   * @param {Task} task task model
   * @param {Object} input
   * @property {Object} input.task_optionals
   * @property {User} input.user
   * @property {Customer} input.customer
   * @param {Function} next
   *
   */
  create (task, input, next) {
    next || (next = () => {})

    if (
      input.origin !== JobConstants.ORIGIN_USER &&
      task.user_inputs === true
    ) {
      // we don't care about automatic arguments,
      // a user must enter the arguments values
      input.lifecycle = LifecycleConstants.ONHOLD
      let argsValues = []
      createJob({ task, vars: input, argsValues: [] })
        .then(job => next(null, job))
        .catch(err => next(err))

      return
    }

    /**
     *
     * @todo remove script_arguments when all agents are version 0.14.1 or higher
     * @todo upgrade templates on db. replace property script_arguments wuth task_arguments
     *
     */
    let argsDefinition = (task.task_arguments || task.script_arguments)
    let inputArgsValues = (input.task_arguments_values || input.script_arguments)

    this.prepareTaskArgumentsValues(
      argsDefinition,
      inputArgsValues,
      (argsErr, argsValues) => {
        createJob({
          task,
          vars: input,
          argsValues,
          beforeSave: (job, callback) => {
            // notification task arguments should not be validated
            if (TaskConstants.TYPE_NOTIFICATION === task.type || !argsErr) {
              return callback()
            }

            // abort execution
            job.result = { log: JSON.stringify(argsErr) }
            job.output = JSON.stringify(argsErr.errors)
            job.state = StateConstants.ERROR
            job.lifecycle = LifecycleConstants.TERMINATED
            callback()
          }
        }).then(job => next(null, job)).catch(err => next(err))
      }
    )
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

      const runDate =  Date.now() + task.grace_time * 1000
      const data = {
        schedule: { runDate },
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
   * @param {Object[]} argumentsDefinition stored definition
   * @param {Object{}} argumentsValues user provided values
   * @param {Function} next
   *
   */
  prepareTaskArgumentsValues (argumentsDefinition, argumentsValues, next) {
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
            // user input required
            let found = searchInputArgumentValueByOrder(argumentsValues, def.order)

            // the argument is not present within the provided request arguments
            if (found === undefined) {
              errors.required(def.label, null, 'task argument is required.')
            } else {
              if (!found) { // null
                value = found
              } else {
                value = (found.value || found)
                if (typeof value !== 'string') {
                  value = JSON.stringify(value)
                }
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

class AbstractJob {
  constructor (input) {
    this.input = input
    this.task = input.task
    this.vars = input.vars
    this.argsValues = input.argsValues
    this.beforeSave = input.beforeSave
    this.job = null
  }

  /**
   * @return Promise
   */
  async create () {
    try {
      await this.build()
    } catch (err) {
      await this.terminateBuild(err)
    }
    return this.job
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
    throw new Error('Abstract Method Called')
  }

  async saveJob (job) {
    const beforeSave = this.beforeSave
    if (beforeSave && typeof beforeSave === 'function') {
      await new Promise((resolve, reject) => {
        beforeSave.call(beforeSave, job, (err) => {
          if (err) { reject(err) }
          else { resolve() }
        })
      })
    }

    await job.save()

    this.task.execution_count += 1
    await this.task.save()

    return job
  }

  setupJobBasicProperties (job) {
    const { task, vars, argsValues } = this

    if (task.workflow_id) {
      if (!vars.workflow_job_id) {
        logger.error('%o', task)
        return next( new Error('missing workflow job') )
      }

      job.workflow = task.workflow_id
      job.workflow_id = task.workflow_id
      job.workflow_job = vars.workflow_job_id
      job.workflow_job_id = vars.workflow_job_id
    }

    // copy embedded task object
    job.task = Object.assign({}, task.toObject(), {
      customer: null,
      host: null
    }) // >>> add .id  / embedded

    job.logging = (task.logging || false)
    job.task_id = task._id
    job.task_arguments_values = argsValues
    job.host_id = task.host_id
    job.host = task.host_id
    job.name = task.name
    job.state = (vars.state || StateConstants.IN_PROGRESS)
    job.lifecycle = (vars.lifecycle || LifecycleConstants.READY)
    job.customer_id = vars.customer._id
    job.customer_name = vars.customer.name
    job.user_id = (vars.user && vars.user.id)
    job.notify = vars.notify
    job.origin = vars.origin
    //job.user = vars.user._id
    //job.event = vars.event || null
    //job.event_data = vars.event_data || {}
    //job.event_id = vars.event_id || null
    return job
  }
}

class ApprovalJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Approval()
  }

  async build () {
    /** approval job is created onhold , waiting approvers decision **/
    const job = this.job
    this.setupJobBasicProperties(job)
    await this.setDynamicProperties(job)
    job.lifecycle = LifecycleConstants.ONHOLD
    return this.saveJob(job)
  }

  async setDynamicProperties (job) {
    const dynamicSettings = [
      'approvers',
      'success_label',
      'failure_label',
      'cancel_label',
      'ignore_label'
    ]

    let dynamic = this.vars.task_optionals
    if (dynamic) {
      let settings = dynamic[ TaskConstants.TYPE_APPROVAL ]
      if (settings) {
        for (let prop of dynamicSettings) {
          if (settings[prop]) {
            let value = settings[prop]
            if (prop === 'approvers') {
              // should validate
              value = await App.gateway.user.emailToObjectID(value)
            }

            job[prop] = value
          }
        }
      }
    }
  }
}

class ScriptJob extends AbstractJob {
  constructor (input) {
    super(input)
    this.job = new JobModels.Script()
  }

  async build () {
    const job = this.job
    const { task, argsValues, vars } = this
    const script = await Script.findById(task.script_id)

    if (!script) {
      const msg = 'cannot create job. script is no longer available'
      logger.error(msg)

      const Err = new Error(msg)
      Err.statusCode = 404
      throw Err
    }

    this.setupJobBasicProperties(job)

    job.script = script.toObject() // >>> add .id  / embedded
    job.script_id = script._id
    job.script_arguments = argsValues
    job.script_runas = task.script_runas
    job.timeout = task.timeout
    job.env = Object.assign({
      THEEYE_JOB: JSON.stringify({
        id: job._id,
        task_id: task._id
      }),
      THEEYE_JOB_USER: JSON.stringify({
        id: vars.user.id,
        email: vars.user.email
      }),
      THEEYE_JOB_WORKFLOW: JSON.stringify({
        job_id: (vars.workflow_job_id || null),
        id: (vars.workflow_id || null)
      }),
      THEEYE_ORGANIZATION_NAME: JSON.stringify(vars.customer.name),
      THEEYE_API_URL: JSON.stringify(App.config.system.base_url)
    }, task.env)

    return this.saveJob(job)
  }
}

class ScraperJob extends AbstractJob {
  async build () {
    const job = new JobModels.Scraper()
    this.setupJobBasicProperties(job)
    job.timeout = this.task.timeout
    return this.saveJob(job)
  }
}

class DummyJob extends AbstractJob {
  async build () {
    const job = new JobModels.Dummy()
    this.setupJobBasicProperties(job)
    return this.saveJob(job)
  }
}

class NotificationJob extends AbstractJob {
  async build () {
    const job = new JobModels.Notification()
    this.setupJobBasicProperties(job)
    return this.saveJob(job)
  }
}

const JobsBuilderMap = {}
JobsBuilderMap[ TaskConstants.TYPE_SCRIPT ] = ScriptJob
JobsBuilderMap[ TaskConstants.TYPE_SCRAPER ] = ScraperJob
JobsBuilderMap[ TaskConstants.TYPE_APPROVAL ] = ApprovalJob
JobsBuilderMap[ TaskConstants.TYPE_DUMMY ] = DummyJob
JobsBuilderMap[ TaskConstants.TYPE_NOTIFICATION ] = NotificationJob

/**
 *
 * @param {Object} input controlled internal input
 * @property {Object} input.vars request/process provided arguments
 * @property {Task} input.task
 * @property {Object} input.taskOptionals
 * @property {Array} input.argsValues task arguments values
 *
 * @return Promise
 *
 */
const createJob = (input) => {
  //(vars.task_optionals || {})
  const { task } = input

  if ( ! JobsBuilderMap[ task.type ] ) {
    throw new Error(`Invalid or undefined task type ${task.type}`)
  }

  const builder = new JobsBuilderMap[ task.type ]( input )
  return builder.create()
}

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
