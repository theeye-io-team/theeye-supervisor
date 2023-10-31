
const App = require('../../app')
const after = require('lodash/after')
const logger = require('../../lib/logger')('service:resource')
const ResourcesNotifications = require('./notifications')

const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const MonitorConstants = require('../../constants/monitors')
const Lifecycle = require('../../constants/lifecycle')
// Entities
const MonitorEvent = require('../../entity/event').MonitorEvent
const ResourceModel = require('../../entity/resource').Entity
const MonitorModel = require('../../entity/monitor').Entity
const MonitorTemplate = require('../../entity/monitor/template').Entity
const Host = require('../../entity/host').Entity
const Tag = require('../../entity/tag').Entity
//const dbFilter = require('../lib/db-filter')

function Service (resource) {
  const _resource = resource

  const needToSendUpdatesStoppedEmail = (resource) => {
    let res = (
      resource.type === MonitorConstants.RESOURCE_TYPE_HOST ||
      resource.failure_severity === MonitorConstants.MONITOR_SEVERITY_CRITICAL
    )

    return res
  }

  const updateResourceLastEvent = (resource, input) => {
    if (!input) { return }
    resource.last_event = input || {}
    if (input.data) {
      if (input.data.output) { // output data specified
        resource.last_event.output = input.data.output
      } else {
        resource.last_event.output = [ JSON.stringify(input.data) ]
      }
    }
  }

  const logStateChange = (resource,input) => {
    const payload = {
      hostname: resource.hostname,
      monitor_event: input.event_name,
      custom_event: input.custom_event,
      state: input.state,
      organization: resource.customer_name,
      model_id: resource._id,
      model_name: resource.name,
      model_type: resource.type,
      operation: Constants.UPDATE
    }
    const topic = TopicsConstants.monitor.state
    App.logger.submit(resource.customer_name, topic, payload) // topic = topics.monitor.state
  }

  const sendStateChangeEventNotification = (resource, input, message) => {
    const topic = TopicsConstants.monitor.state
    const payload = {
      model_type: 'Resource',
      model: resource,
      model_id: resource._id,
      hostname: resource.hostname,
      organization: resource.customer_name,
      organization_id: resource.customer_id,
      operation: Constants.UPDATE,
      monitor_event: input.event_name,
      custom_event: input.custom_event
    }

    // attach email data
    if (message) {
      payload.subject = message.subject
      payload.body = message.body
    }

    App.notifications.generateSystemNotification({
      topic: topic,
      data: payload
    })
  }

  /**
   *
   * @param {String} resource_id
   * @param {Object} input
   * @property {Object} input.data
   *
   */
  const dispatchStateChangedEvent = async (resource, input) => {
    try {
      const resource_id = resource._id
      const event_name = input.event_name

      const monitor = await MonitorModel.findOne({ resource_id })
      if (!monitor) {
        throw new Error(`resource ${resource_id} monitor not found`)
      }

      logger.log('searching monitor [%s] event [%s] ', monitor.name, event_name)

      let event = await MonitorEvent.findOne({
        emitter_id: monitor._id,
        enable: true,
        name: event_name 
      })

      //if (!event) {
      //  event = new MonitorEvent({
      //    emitter_id: resource._id,
      //    name: event_name,
      //    creation_date: new Date(),
      //    last_update: new Date()
      //  })
      //}

      // the monitor doesn't has events attached to it.
      // will not trigger anything
      if (event) {
        const config = (monitor.config || {})

        // remove log and lastline
        const output = Object.assign(
          {},
          resource.last_event?.data || {},
          {
            log: undefined,
            lastline: undefined
          }
        )

        const data = [{
          type: resource.type,
          monitor_id: resource._id.toString(),
          hostname: resource.hostname,
          output,
          event_name,
          config
        }]

        App.eventDispatcher.dispatch({
          topic: TopicsConstants.monitor.state,
          event,
          resource,
          data
        })
      }
    } catch (err) {
      logger.error(err)
    }
  }

  const generateStateChangedMessage = async (resource, input) => {
    try {
      if (resource.alerts === false) {
        let err = new Error('MonitorEventIgnored')
        err.reason = 'alerts disabled'
        throw err
      }

      if (resource.failure_severity === MonitorConstants.MONITOR_SEVERITY_LOW) {
        let err = new Error('MonitorEventIgnored')
        err.reason = 'monitor severity LOW'
        throw err
      }

      await resource.populate('monitor').execPopulate()
      const specs = Object.assign({}, input, { resource })

      return ResourcesNotifications(specs)
    } catch (err) {
      if (/MonitorEventIgnored/.test(err.message) === true) {
        logger.log(err.message)
        logger.log(err.reason)
        return
      } else {
        logger.error(err.message)
        return err
      }
    }
  }

  const getEventSeverity = (resource) => {
    const hasSeverity = resource.failure_severity &&
      MonitorConstants.MONITOR_SEVERITIES.indexOf(
        resource.failure_severity.toUpperCase()
      ) !== -1

    // severity is set and is valid
    if (hasSeverity) {
      return resource.failure_severity
    }

    // else try to determine the severity
    return (resource.type == MonitorConstants.RESOURCE_TYPE_DSTAT) ?
      MonitorConstants.MONITOR_SEVERITY_LOW : MonitorConstants.MONITOR_SEVERITY_HIGH
  }

  /**
   *
   * @private
   * @param String state
   * @return String
   *
   */
  const isSuccess = (state) => {
    return MonitorConstants.SUCCESS_STATES.indexOf(state.toLowerCase()) != -1
  }
  const isFailure = (state) => {
    return MonitorConstants.FAILURE_STATES.indexOf(state.toLowerCase()) != -1
  }
  const filterStateEvent = (state) => {
    if (!state || typeof state != 'string') {
      return MonitorConstants.RESOURCE_ERROR
    }

    // state is a recognized state
    if (MonitorConstants.MONITOR_STATES.indexOf(state) !== -1) {
      return state
    }

    if (isSuccess(state)) {
      return MonitorConstants.RESOURCE_NORMAL
    }
    if (isFailure(state)) {
      return MonitorConstants.RESOURCE_FAILURE
    }
    return MonitorConstants.RESOURCE_ERROR
  }

  /**
   *
   * state change handlers
   *
   */
  const handleFailureState = async (resource,input,config) => {
    const failure_threshold = config.fails_count_alert
    logger.log('resource "%s" check fails.', resource.name)

    updateResourceLastEvent(resource, input)

    resource.fails_count++
    logger.log(
      'resource %s[%s] failure event count %s/%s', 
      resource.name, 
      resource._id,
      resource.fails_count,
      failure_threshold
    )

    // current resource state
    if (resource.state != MonitorConstants.RESOURCE_FAILURE) {
      // it is time to start sending failure alerts
      if (resource.fails_count >= failure_threshold) {
        logger.log('resource "%s" state failure', resource.name)

        input.event_name = MonitorConstants.RESOURCE_FAILURE
        input.custom_event = input.event
        input.failure_severity = getEventSeverity(resource)
        resource.state = MonitorConstants.RESOURCE_FAILURE

        let message = await generateStateChangedMessage(resource, input)
        sendStateChangeEventNotification(resource, input, message)
        logStateChange(resource, input)
        dispatchStateChangedEvent(resource, input)
      }
    }
  }

  const handleNormalState = async (resource, input, config) => {
    logger.log('"%s"("%s") state is normal', resource.name, resource.type)

    updateResourceLastEvent(resource, input)

    if (resource.state === MonitorConstants.RESOURCE_NORMAL) {
      if (resource.fails_count !== 0) {
        logger.log('monitor state restarted')
        resource.fails_count = 0
        resource.state = MonitorConstants.RESOURCE_NORMAL
      }
      return
    }

    // monitor state check back to success
    input.custom_event = input.event
    input.failure_severity = getEventSeverity(resource)

    const isRecoveredFromFailure = Boolean(resource.state === MonitorConstants.RESOURCE_FAILURE)
    let message
    if (isRecoveredFromFailure) {
      input.event_name = MonitorConstants.RESOURCE_RECOVERED
      message = await generateStateChangedMessage(resource, input)
    } else {
      // is recovered from updates_stopped
      input.event_name = MonitorConstants.RESOURCE_STARTED
      if (needToSendUpdatesStoppedEmail(resource)) {
        message = await generateStateChangedMessage(resource, input)
      }
    }

    resource.recovery_count++
    resource.fails_count = 0
    resource.state = MonitorConstants.RESOURCE_NORMAL

    sendStateChangeEventNotification(resource, input, message)
    logStateChange(resource, input)
    dispatchStateChangedEvent(resource, input)
    // reset state
    logger.log('monitor "%s" recovered', resource.name)
  }

  const handleUpdatesStoppedState = async (resource, input, config) => {
    const newState = MonitorConstants.RESOURCE_STOPPED
    const failure_threshold = config.fails_count_alert
    resource.fails_count++

    logger.log(
      'resource %s[%s] notifications stopped count %s/%s',
      resource.name,
      resource._id,
      resource.fails_count,
      failure_threshold
    )

    const resourceUpdatesStopped = (
      resource.state != newState &&
      resource.fails_count >= failure_threshold
    )

    const dispatchNotifications = async () => {
      logStateChange(resource, input) // Logger/Streaming
      dispatchStateChangedEvent(resource, input) // Trigger/Workflow

      //@TODO unify
      let message
      if (needToSendUpdatesStoppedEmail(resource)) {
        message = await generateStateChangedMessage(resource, input) // Notification System
      }
      sendStateChangeEventNotification(resource, input, message) // Notification System
    }

    // current resource state
    if (resourceUpdatesStopped) {
      logger.log('resource "%s" notifications stopped', resource.name)

      input.event_name = MonitorConstants.RESOURCE_STOPPED // generic event
      input.custom_event = input.event // to report a specific event 
      input.failure_severity = getEventSeverity(resource)
      resource.state = newState
      dispatchNotifications()

      // if the resource is a host
      const isHost = (resource.type === MonitorConstants.RESOURCE_TYPE_HOST)
      if (isHost) {
        cancelAssignedJobsToHost(resource.host_id)
      }
    }
  }

  /**
   *
   * espeshial case of monitor state changed.
   * the resource was updated or changed or was not present and currently created.
   * the monitor trigger the changed event and the supervisor emit the event internally
   *
   * this is emitted only once to trigger the change event
   *
   */
  const handleChangedStateEvent = async (resource,input,config) => {
    const newState = MonitorConstants.RESOURCE_NORMAL
    updateResourceLastEvent(resource, input)
    resource.state = newState

    input.event_name = MonitorConstants.RESOURCE_CHANGED
    input.custom_event = input.event
    input.failure_severity = getEventSeverity(resource)

    logStateChange(resource, input) // Logger/Streaming
    dispatchStateChangedEvent(resource, input) // Trigger/Workflow

    //@TODO unify
    let message = await generateStateChangedMessage(resource, input) // Notification System
    sendStateChangeEventNotification(resource, input, message) // Notification System
  }

  /**
   * @public
   * @param Object input
   * @param Function next
   * @return null
   */
  this.handleState = async (input) => {
    const resource = _resource
    input.state = filterStateEvent(input.state)

    resource.last_check = new Date()

    const monitorConfig = App.config.monitor // global application configuration

    switch (input.state) {
      case MonitorConstants.RESOURCE_CHANGED:
        await handleChangedStateEvent(resource, input, monitorConfig)
        break
      case MonitorConstants.AGENT_STOPPED:
      case MonitorConstants.RESOURCE_STOPPED:
        await handleUpdatesStoppedState(resource, input, monitorConfig)
        break
      case MonitorConstants.RESOURCE_NORMAL:
        resource.last_update = new Date()
        await handleNormalState(resource, input, monitorConfig)
        break
      default:
      case MonitorConstants.RESOURCE_FAILURE:
        resource.last_update = new Date()
        await handleFailureState(resource, input, monitorConfig)
        break
    }

    await resource.save()
    return
  }
}

module.exports = Service;

Service.populate = function (resource,done) {
  MonitorModel
    .findOne({ resource_id: resource._id })
    .exec((err, monitor) => {
      if (err) {
        logger.error(err)
        return done(err)
      }

      resource.monitor = monitor
      done(null, resource)
    })
}

Service.populateAll = function (resources,next) {
  var result = []
  if (!Array.isArray(resources) || resources.length === 0) {
    return next(null,result)
  }

  const populated = after(resources.length,() => next(null,result))

  for (var i=0;i<resources.length;i++) {
    const resource = resources[i]
    this.populate(resource,() => {
      result.push(resource) // populated resource
      populated()
    })
  }
}

Service.findHostResources = function(host,options,done) {
  var query = { 'host_id': host._id };
  if(options.type) query.type = options.type;
  ResourceModel.find(query,(err,resources)=>{
    if(err){
      logger.error(err);
      return done(err);
    }
    if(!resources||resources.length===0){
      logger.log('host resources not found for host %s', host.hostname);
      return done();
    }
    if(options.ensureOne){
      if(resources.length>1){
        logger.error('more than one resource found for host %s type %s', host.hostname, options.type);
        return done();
      }
      else return done(null,resources[0]);
    }
    done(null,resources);
  });
}

/**
 *
 * create entities
 * @author Facugon
 * @param {Object} input
 * @property {} input.
 *
 */
Service.create = async (input, next) => {
  next || (next=()=>{})

  try {
    logger.log('creating resource for host %j', input)

    const attrs = Object.assign({}, input, { name: input.name })
    const resource = await createResourceMonitor(attrs)

    logger.log('resource & monitor created')
    const monitor = resource.monitor

    const topic = TopicsConstants.monitor.crud
    App.logger.submit(monitor.customer_name, topic, { // topic = topics.monitor.crud , BULK CREATE
      hostname: monitor.hostname,
      organization: monitor.customer_name,
      model_id: monitor._id,
      model_name: monitor.name,
      model_type: monitor.type,
      user_id: input.user.id,
      user_email: input.user.email,
      //user_name: input.user.username,
      operation: Constants.CREATE
    })

    Service.createDefaultEvents(monitor, input.customer)
    Tag.create(input.tags,input.customer)

    App.jobDispatcher.createAgentUpdateJob(monitor.host_id)
    next(null, resource)
    return resource
  } catch (err) {
    logger.error(err)
    next(err)
  }
}

Service.createDefaultEvents = function (monitor, customer, done) {
  done || (done=function(){})

  const createBaseMonitorEvents = (next) => {
    // CREATE DEFAULT EVENT
    const base = {
      customer_id: customer._id,
      customer: customer,
      emitter: monitor, 
      emitter_id: monitor._id
    }

    MonitorEvent.create(
      // NORMAL state does not trigger EVENT
      //{ customer: customer, emitter: monitor, name: MonitorConstants.RESOURCE_NORMAL } ,
      Object.assign({}, base, { name: MonitorConstants.RESOURCE_RECOVERED }) ,
      Object.assign({}, base, { name: MonitorConstants.RESOURCE_STOPPED }) ,
      Object.assign({}, base, { name: MonitorConstants.RESOURCE_FAILURE }) ,
      (err, created) => {
        if (err) { logger.error(err) }
        next(err)
      }
    )
  }

  const createFileMonitorEvents = (next) => {
    MonitorEvent.create({
      customer: customer,
      emitter: monitor,
      emitter_id: monitor._id,
      name: MonitorConstants.RESOURCE_CHANGED
    }, err => {
      if (err) { logger.error(err) }
      next(err)
    })
  }

  const createHostMonitorEvents = (next) => {
    MonitorEvent.create({
      customer: customer,
      emitter: monitor,
      emitter_id: monitor._id,
      name: MonitorConstants.RESOURCE_STARTED
    }, err => {
      if (err) { logger.error(err) }
      next(err)
    })
  }

  createBaseMonitorEvents(err => {
    if (err) {
      logger.error(err)
      return done(err)
    }

    if (monitor.type === MonitorConstants.RESOURCE_TYPE_FILE) {
      createFileMonitorEvents(done)
    } else if (monitor.type === MonitorConstants.RESOURCE_TYPE_HOST) {
      createHostMonitorEvents(done)
    } else {
      done()
    }
  })
}

/**
 *
 * update entities
 *
 */
Service.update = async (input, next) => {
  const updates = input.updates
  const resource = input.resource

  logger.log('updating monitor %j', updates)

  // remove properties that cannot be changed
  delete updates.last_event
  delete updates.last_check
  delete updates.last_update
  delete updates.creation_date
  delete updates.resource_id
  delete updates.resource
  delete updates.monitor_id
  delete updates.monitor
  delete updates.customer_name
  delete updates.customer_id
  delete updates.customer
  delete updates.user_id
  delete updates.user
  delete updates._id
  delete updates.id
  delete updates.type
  delete updates._type
  delete updates.fails_count
  delete updates.recovery_count

  // remove monitor from template
  updates.template = null
  updates.template_id = null

  let monitor = await MonitorModel.findOne({ resource_id: resource._id })
  if (!monitor) {
    throw new Error('resource monitor not found')
  }

  resource.set( Object.assign({}, updates) )
  await resource.save()

  let previous_host_id = monitor.host_id
  let new_host_id
  if (updates.host_id) {
    new_host_id = updates.host_id.toString() // mongo ObjectID
  } else {
    new_host_id = monitor.host_id // current
  }

  return new Promise((resolve, reject) => {
    App.resourceMonitor.update(monitor, updates, (err) => {
      if (err) {
        logger.error(err)
        reject(err)
      } else {
        if (monitor.runOnHost() === true) {
          App.jobDispatcher.createAgentUpdateJob(new_host_id)
          // if monitor host is changed, the new and the old agents should be notified
          if (new_host_id !== null && previous_host_id != new_host_id) {
            App.jobDispatcher.createAgentUpdateJob(previous_host_id)
          }
        }

        Tag.create(updates.tags, { _id: resource.customer_id })
        resource.monitor = monitor
        resolve(resource)
      }
    })
  })
}

/**
 *
 * static methods
 *
 */
Service.fetchBy = function (filter,next) {
  ResourceModel.fetchBy(filter,function (err,resources) {
    if (resources.length===0) return next(null,[])

    const pub = []
    const fetched = after(resources.length,() => {
      next(null, pub)
    })

    resources.forEach(resource => {
      var data = resource.toObject()

      MonitorModel.findOne({
        resource_id: resource._id
      }).exec((err,monitor) => {
        if (err) {
          logger.error('%o',err)
          return fetched()
        }

        if (!monitor) {
          logger.error('monitor for resource id %s was not found',resource._id)
          data.monitor = null
        } else {
          data.monitor = monitor.toObject()
        }

        pub.push(data)
        fetched()
      })
    })
  })
}

/**
 *
 * @author Facundo
 *
 */
Service.remove = function (input, done) {
  done || (done = function(){})

  const resource = input.resource

  logger.log('removing resource "%s" monitors', resource.name)

  resource.populate('monitor', (err) => {
    if (err) {
      logger.error(err)
      return done(err)
    }
    let monitor = resource.monitor
    if (!monitor) {
      logger.error('monitor not found.')
      resource.remove(done)
    } else {
      monitor.remove(err => {
        if (err) {
          logger.error('cannot remove monitor %s', monitor.name)
          logger.error(err)
          return done(err)
        }

        logger.log('monitor %s removed', monitor.name)

        MonitorEvent.remove({ emitter_id: monitor._id }, (err) => {
          if (err) logger.error(err)
        })

        if (input.notifyAgents) {
          App.jobDispatcher.createAgentUpdateJob(monitor.host_id)
        }

        resource.remove(done)
      })
    }
  })
}

Service.disableResourcesByCustomer = function(customer, doneFn){
  ResourceModel
    .find({ 'customer_id': customer._id })
    .exec(function(error, resources){
      if(resources.length != 0){
        for(var i=0; i<resources.length; i++){
          var resource = resources[i];

          resource.enable = false;
          resource.save(error => {
            if(error) {
              logger.log('ERROR updating resource property');
              throw error;
            }
          });
        }
      }
    });
}

/**
 *
 * API to create multiple resource and monitor linked to a host
 * @author Facugon
 * @param Array hosts
 * @param Object input
 * @param Function done
 * @return null
 *
 */
Service.createResourceOnHosts = function (hosts, input, done) {
  done||(done=()=>{});
  logger.log('preparing to create resources');
  logger.log(input);
  var errors = null;
  var monitors = [];

  var completed = after(hosts.length, function(){
    logger.log('all hosts processed');
    done(errors, monitors);
  });

  var hostProcessed = function(hostId, error, data){
    if (error) {
      errors = errors||{};
      logger.log('there are some error %o', error);
      errors[ hostId ] = error.message;
    } else {
      logger.log('host resource and monitor created');
      monitors.push( data );
    }
    completed();
  }

  for (var i=0; i<hosts.length; i++) {
    var hostId = hosts[i];
    handleHostIdAndData(hostId,input,function(error,result){
      hostProcessed(hosts[i], error, result);
    });
  }
}

/**
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {Object} options
 * @param {Host} options.host
 * @param {Customer} options.customer
 * @param {ResourceTemplate} options.template
 * @param {Function(Error,Resource)} options.done
 *
 */
Service.createFromTemplate = function(options) {
  const done = options.done || (() => {})
  const template = options.template
  const host = options.host
  const customer = options.customer

  const generateResourceModel = (input) => {
    const data = Object.assign({}, input, {
      host: host._id,
      host_id: host._id,
      hostname: host.hostname,
      template: template._id,
      template_id: template._id,
      last_update: new Date(),
      last_event: {},
      _type: 'Resource'
    })
    // remove template _id
    delete data.id
    delete data._id
    logger.log('creating resource from template %j', data)
    return new ResourceModel(data)
  }

  const generateMonitorModel = (input) => {
    const data = Object.assign({}, input.monitor_template, {
      host: host,
      host_id: host._id,
      template: template.monitor_template._id,
      template_id: template.monitor_template._id,
      customer: resource.customer_id,
      customer_id: resource.customer_id,
      customer_name: resource.customer_name,
      _type: 'ResourceMonitor'
    })
    // remove template _id
    delete data._id
    delete data.id
    logger.log('creating monitor from template %j', data)
    return new MonitorModel(data)
  }

  const input = template.toObject()
  input.monitor_template = template.monitor_template.toObject()

  if (template.type === 'dstat') {
    input.name = 'Health'
    input.monitor_template.name = 'Health'
  }
  if (template.type === 'psaux') {
    input.name = 'Processes List'
    input.monitor_template.name = 'Process List'
  }

  var resource = generateResourceModel(input)
  var monitor = generateMonitorModel(input)

  // the ids are generated as soon as the models are created.
  // dont need to save them before
  resource.monitor_id = monitor._id
  resource.monitor = monitor._id

  monitor.resource_id = resource._id
  monitor.resource = resource._id

  resource.save(err => {
    if (err) {
      logger.error('%o',err)
      return done(err)
    }

    monitor.save(err => {
      if(err) {
        logger.error('%o',err)
        return done(err);
      }

      resource.monitor = monitor

      Service.createDefaultEvents(monitor, customer, () => {
        done(null,resource)
      })
    })
  })
}

//Service.onScriptRemoved = function (script) {
//  updateMonitorsWithDeletedScript(script);
//}

//Service.onScriptUpdated = function (script) {
//  notifyScriptMonitorsUpdate(script);
//}

/**
 *
 * @param {Array<Resource>} resources models
 * @return {Resource} model
 *
 */
Service.getResourcesWorstState = function (resources) {
  // check first if resources are ok
  let workingFine = true
  resources.forEach(r => {
    // is a recognized state
    if (MonitorConstants.MONITOR_STATES_ORDER.indexOf(r.state) !== -1) {
      // ... and is not normal
      if (r.state !== MonitorConstants.RESOURCE_NORMAL) {
        workingFine = false
      }
    } else {
      // or state is not recognized ?
      workingFine = false
    }
  })

  if (workingFine) {
    return MonitorConstants.RESOURCE_NORMAL
  }

  // then sort by state
  resources.sort( (ra, rb) => {
    let stOrderA = MonitorConstants.MONITOR_STATES_ORDER.indexOf(ra.state)
    let stOrderB = MonitorConstants.MONITOR_STATES_ORDER.indexOf(rb.state)

    // compare state order
    if (stOrderA < stOrderB) { return -1 } // go first
    if (stOrderA > stOrderB) { return 1 } // go after
    else {
      // if same state, compare failure severity order
      let sevOrderA = MonitorConstants.MONITOR_SEVERITIES.indexOf(ra.failure_severity)
      let sevOrderB = MonitorConstants.MONITOR_SEVERITIES.indexOf(rb.failure_severity)
      if (sevOrderA < sevOrderB) { return -1 } // go first
      if (sevOrderA > sevOrderB) { return 1 } // go after
      return 0 // mantain order
    }
  })

  // return the state of the first element in the list
  return resources[0].state
}

/**
 *
 *
 * @author Facugon
 *
 */
const handleHostIdAndData = (hostId, input, doneFn) => {
  Host.findById(hostId, function(err,host){
    if (err) return doneFn(err);

    if (!host) {
      var e = new Error('invalid host id ' + hostId);
      e.statusCode = 400;
      return doneFn(e);
    }

    input.host_id = host._id
    input.host = host._id
    input.hostname = host.hostname

    Service.create(input, doneFn)
  })
}

/**
 *
 * create entities
 *
 */
const createResourceMonitor = async (input, done) => {
  const type = ( input.type || input.monitor_type )
  let monitor
  monitor = await App.resourceMonitor.create(type, input)

  if (!monitor) {
    var err = new Error('invalid resource data')
    err.statusCode = 400
    throw err
  }

  logger.log('creating resource')
  let resource = new ResourceModel(input)

  // referencing
  resource.monitor = monitor
  resource.monitor_id = monitor._id

  monitor.resource = resource._id
  monitor.resource_id = resource._id

  await resource.save()
  await monitor.save()
  return resource
}

/**
 * if any job is assigned to the host's agent cancel it.
 */
const cancelAssignedJobsToHost = (host_id) => {
  const user = App.user // automatic job cancelation
  const filter = {
    where: {
      host_id: host_id
    }
  }

  // search for jobs to cancel
  logger.log('searching for jobs to cancel')
  App.jobDispatcher.fetchBy(filter, (err, jobs) => {
    if (err) return logger.error(err)

    if (jobs.length===0) {
      // nothing to do
      return
    }

    jobs
      .filter(job => job.lifecycle === Lifecycle.ASSIGNED)
      .forEach(job => App.jobDispatcher.cancel({ job, user }))
  })
}
