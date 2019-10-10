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
   * @param {Task} task
   * @param {Object} input
   * @property {User} input.user
   * @property {Customer} input.customer
   * @param {Function} next
   *
   */
  create (task, input, next) {
    next || (next = () => {})

    /**
     *
     * @todo remove script_arguments when all agents are version 0.14.1 or higher
     * @todo upgrade templates on db. replace property script_arguments wuth task_arguments
     *
     */
    let argsDefinition = (
      task.task_arguments ||
      task.script_arguments
    )

    let inputArgsValues = (
      input.task_arguments_values ||
      input.script_arguments
    )

    this.prepareTaskArgumentsValues(
      argsDefinition,
      inputArgsValues,
      (err, argsValues) => {
        if (err) {
          // err on arguments. cannot continue.
          // create a terminated-with-errors job.
          createJob({
            task,
            vars: input,
            argsValues,
            beforeSave: (job, saveCb) => {
              job.lifecycle = LifecycleConstants.TERMINATED
              job.state = StateConstants.ERROR
              job.result = {
                log: 'invalid task arguments. cannot execute'
              }
              saveCb()
            }
          }, next)
        } else {
          if (
            task.grace_time > 0 &&
            ( // automatic origin
              input.origin === JobConstants.ORIGIN_WORKFLOW ||
              input.origin === JobConstants.ORIGIN_TRIGGER_BY
            )
          ) {
            // use delayed execution with grace time
            const runDate =  Date.now() + task.grace_time * 1000
            createScheduledJob({
              task,
              runDate,
              vars: input,
            }, next)
          } else {
            createJob({
              task,
              vars: input,
              argsValues
            }, next)
          }
        }
      }
    )
  },
  /**
   *
   * @param {Object[]} argumentsDefinition stored definition
   * @param {Object{}} argumentsValues user provided values
   * @param {Function} next callback
   *
   */
  prepareTaskArgumentsValues (
    argumentsDefinition,
    argumentsValues,
    next
  ) {
    let errors = new ErrorHandler()
    let filteredArguments = []

    if (
      !Array.isArray(argumentsDefinition) ||
      argumentsDefinition.length === 0
    ) {
      return next(null, [])
    }

    if (!Array.isArray(argumentsValues)) {
      argumentsValues = []
    }

    argumentsDefinition.forEach((def,index) => {
      if (Boolean(def)) { // is defined
        if (typeof def === 'string') { // fixed value old version compatibility
          filteredArguments[index] = def
        } else if (def.type) {
          if (def.type === TaskConstants.ARGUMENT_TYPE_FIXED) {
            //
            // do not replace fixed values !
            //
            //let found = searchInputArgumentValueByOrder(argumentsValues, def.order)
            //if (found) { // use found value
            //  filteredArguments[def.order] = (found.value || found)
            //} else {
            //  filteredArguments[def.order] = def.value
            //}
            filteredArguments[def.order] = def.value
          } else if (
            def.type === TaskConstants.ARGUMENT_TYPE_INPUT ||
            def.type === TaskConstants.ARGUMENT_TYPE_SELECT ||
            def.type === TaskConstants.ARGUMENT_TYPE_DATE ||
            def.type === TaskConstants.ARGUMENT_TYPE_FILE ||
            def.type === TaskConstants.ARGUMENT_TYPE_REMOTE_OPTIONS
          ) {
            // require user input
            let found = searchInputArgumentValueByOrder(argumentsValues, def.order)
            // the argument is not present within the provided request arguments
            if (found === undefined) {
              errors.required(def.label, null, 'task argument ' + def.label + ' is required.')
            } else {
              filteredArguments[def.order] = (found.value || found)
            }
          } else { // bad argument definition
            errors.invalid('arg' + index, def, 'task argument ' + index + ' definition error. unknown type')
          }
        } else { // argument is not a string and does not has a type
          errors.invalid('arg' + index, def, 'task argument ' + index + ' definition error. unknown type')
        }
      }
    })

    if (errors.hasErrors()) {
      const err = new Error('invalid task arguments')
      err.statusCode = 400
      err.errors = errors
      return next(err)
    }

    next(null, filteredArguments)
  }
}

module.exports = JobsFactory

const createScheduledJob = (input, next) => {
  let { task, vars, runDate } = input
  let customer = vars.customer

  let data = {
    schedule: { runDate },
    task,
    customer,
    //event: vars.event._id,
    //event_data: vars.event_data,
    user: vars.user,
    origin: vars.origin,
    notify: true
  }

  App.scheduler.scheduleTask(data, (err, agenda) => {
    if (err) {
      logger.error('cannot schedule workflow job')
      logger.error(err)
      return next (err)
    }

    next (null, agenda)

    App.customer.getAlertEmails(customer.name, (err, emails) => {
      App.jobDispatcher.sendJobCancelationEmail({
        task_secret: task.secret,
        task_id: task.id,
        schedule_id: agenda.attrs._id,
        task_name: task.name,
        hostname: task.host.hostname,
        date: new Date(runDate).toISOString(),
        grace_time_mins: task.grace_time / 60,
        customer_name: customer.name,
        to: emails.join(',')
      })
    })
  })
}

/**
 *
 * @param {Object} input controlled internal input
 * @property {Object} input.vars request/process provided arguments
 * @property {Task} input.task
 * @property {Array} input.argsValues task arguments values
 *
 */
function createJob (input, next) {
  let { task, vars, argsValues } = input
  let beforeSave = input.beforeSave

  const setupJobBasicProperties = (job) => {
    if (task.workflow_id) {
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

    job.task_id = task._id
    job.task_arguments_values = argsValues
    job.host_id = task.host_id
    job.host = task.host_id
    job.name = task.name
    job.lifecycle = LifecycleConstants.READY
    job.state = StateConstants.IN_PROGRESS
    job.customer_id = vars.customer._id
    job.customer_name = vars.customer.name
    job.user_id = vars.user._id
    job.user = vars.user._id
    job.notify = vars.notify
    job.origin = vars.origin
    //job.event = vars.event || null
    //job.event_data = vars.event_data || {}
    //job.event_id = vars.event_id || null
    return job
  }

  const createScraperJob = (done) => {
    const job = new JobModels.Scraper()
    setupJobBasicProperties(job)
    job.timeout = task.timeout
    return saveJob(job, done)
  }

  const createScriptJob = (done) => {
    prepareScript(task.script_id, (err,script) => {
      if (err) { return done (err) }
      const job = new JobModels.Script()
      setupJobBasicProperties(job)
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
          id: vars.user._id,
          email: vars.user.email
        }),
        THEEYE_JOB_WORKFLOW: JSON.stringify({
          job_id: (vars.workflow_job_id || null),
          id: (vars.workflow_id || null)
        })
      }, task.env)

      return saveJob(job, done)
    })
  }

  const createApprovalJob = (done) => {
    /** approval job is created onhold , waiting approver decision **/
    const job = new JobModels.Approval()
    setupJobBasicProperties(job)
    job.lifecycle = LifecycleConstants.ONHOLD
    return saveJob(job, done)
  }

  const createDummyJob = (done) => {
    const job = new JobModels.Dummy()
    setupJobBasicProperties(job)
    return saveJob(job, done)
  }

  const createNotificationJob = (done) => {
    const job = new JobModels.Notification()
    setupJobBasicProperties(job)
    return saveJob(job, done)
  }

  const saveJob = (job, done) => {
    const saveDb = () => {
      job.save(err => {
        if (err) {
          logger.error('%o',err)
          return done(err)
        }
        task.execution_count += 1
        task.save(err => {})

        done(null, job)
      })
    }

    if (beforeSave && typeof beforeSave === 'function') {
      beforeSave.call(beforeSave, job, saveDb)
    } else {
      saveDb()
    }
  }

  switch (task.type) {
    case TaskConstants.TYPE_SCRIPT:
      createScriptJob(next);
      break;
    case TaskConstants.TYPE_SCRAPER:
      createScraperJob(next);
      break;
    case TaskConstants.TYPE_APPROVAL:
      createApprovalJob(next);
      break;
    case TaskConstants.TYPE_DUMMY:
      createDummyJob(next)
      break;
    case TaskConstants.TYPE_NOTIFICATION:
      createNotificationJob(next)
      break;
    default:
      const err = new Error(`invalid or undefined task type ${task.type}`)
      return next(err)
      break;
  }
}

const prepareScript = (script_id, next) =>  {
  const query = Script.findById(script_id)
  query.exec((err, script) => {
    if (err) {
      logger.error('%o',err)
      err.statusCode = 500
      return next(err)
    }

    if (!script) {
      let msg = 'cannot create job. script is no longer available'
      logger.error(msg)
      let err = new Error(msg)
      err.statusCode = 404
      return next(err)
    }

    next(null,script)
  })
}

const searchInputArgumentValueByOrder = (values, searchOrder) => {
  return values.find((arg, idx) => {
    let order
    if (arg.order) { order = arg.order }
    else { order = idx }
    return (order === searchOrder)
  })
}
