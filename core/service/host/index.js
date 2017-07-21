'use strict'

const lodash = require('lodash')
const async = require('async')
const NotificationService = require('../notification')
const CustomerService = require('../customer')
const Handlebars = require('../../lib/handlebars')
const ResourceService = require('../resource')
const HostGroupService = require('./group')
const logger = require('../../lib/logger')('service:host')
const Job = require('../../entity/job').Job;
const Monitor = require('../../entity/monitor').Entity
const Event = require('../../entity/event').Event
const Host = require('../../entity/host').Entity
const HostGroup = require('../../entity/host/group').Entity;
const HostStats = require('../../entity/host/stats').Entity;
const Task = require('../../entity/task').Entity
const Resource = require('../../entity/resource').Entity
const AgentUpdateJob = require('../../entity/job').AgentUpdate
const createMonitor = ResourceService.createResourceOnHosts

function HostService (host) {
  this.host = host
}

module.exports = HostService 

//
//
// Instance Methods
//
//
HostService.prototype = {
  agentUnreachable () {
    const vent = 'agent_unreachable'
    const host = this.host

    CustomerService.getCustomerConfig(
      host.customer_id,
      function (error,config) {
        host.fails_count += 1;
        var maxFails = config.monitor.fails_count_alert;
        logger.log('fails count %d/%d', host.fails_count, maxFails);

        if (host.fails_count > maxFails) {
          if (host.state != vent) {
            logger.log('host "%s" state has changed to "%s"', host.hostname, vent);
            host.state = vent ;

            logger.log('processing "%s" event',vent);
            sendEventNotification(host,vent);
          }
        }

        host.save();
      }
    )
  },
  agentRunning () {
    const vent = 'agent_running'
    const host = this.host

    if (host.state != vent) {
      logger.log('host "%s" state has changed to "%s"', host.hostname, vent)
      host.state = vent
      host.fails_count = 0
      host.save()

      logger.log('processing "%s" event',vent)
      sendEventNotification(host,vent)
    }
  }
}

//
//
// Static Methods
//
//

/**
 *
 * @author Facundo
 * @param {Object} input
 * @property {Resource} input.resource the resource to be removed
 * @property {User} input.user requesting user
 * @param {Function(Error)} done
 *
 */
HostService.removeHostResource = function (input, done) {
  const resource = input.resource
  const user = input.user
  const host_id = resource.host_id

  logger.log('removing host "%s" resource "%s"', host_id, resource._id)

  // find and remove host
  logger.log('removing host')
  Host
    .findById(host_id)
    .exec(function(err, item){
      if (err) {
        logger.error(err)
        return
      }
      if (!item) return
      item.remove((err) => {
        if (err) logger.error(err)
      })
    })

  logger.log('removing host stats')
  // find and remove saved cached host stats
  HostStats
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove resources
  const removeResource = (resource, done) => {
    ResourceService.remove({
      resource: resource,
      notifyAgents: false,
      user: user
    },(err) => {
      if (err) {
        logger.error(err)
        return
      }
      //else logger.log('resource "%s" removed', resource.name)
      done(err)
    });
  }

  logger.log('removing host resources')
  Resource
    .find({ host_id: host_id })
    .exec(function(err, resources){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(resources)||resources.length===0) return
      const resourceRemoved = lodash.after(resources.length, () => {
        // all resources && monitors removed
      })

      for (var i=0; i<resources.length; i++) {
        removeResource(resources[i], resourceRemoved)
      }
    })

  // find and remove host jobs
  logger.log('removing host jobs')
  Job
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove host tasks
  logger.log('removing the host from the tasks')
  Task
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].host_id = null
        items[i].save()
      }
    });

  const removeFromGroup = (group) => {
    const idx = group.hosts.indexOf(host_id)
    if (idx === -1) return
    group.hosts.splice(idx,1)
    group.save()
  }

  logger.log('removing host from groups')
  HostGroup
    .find({ hosts: host_id })
    .exec((err,groups) => {
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(groups) || groups.length===0) return
      for (var i=0; i<groups.length; i++) {
        removeFromGroup(groups[i])
      }
    })
}

/**
 * return host tasks (including triggers) & monitors configuration
 *
 * @param {Host} host
 * @param {Function} next
 */
HostService.config = (host, customer, next) => {
  const data = { resources: [], tasks: [], triggers: [] }

  const resourcesConfig = (done) => {
    Resource.find({
      enable: true,
      host_id: host._id,
      customer_id: customer._id,
      type: { $ne: 'host' }
    }).exec(function(err,resources){
      if (err) return done()
      if (!resources||resources.length===0) return done()

      const completed = lodash.after(resources.length, done)

      resources.forEach(resource => {
        resource.last_event = null
        Monitor.findOne({
          resource_id: resource._id
        }).exec(function(err,monitor){
          resource.monitor = monitor
          data.resources.push(resource)
          completed()
        })
      })
    })
  }

  const tasksConfig = (done) => {
    Task.find({
      enable: true,
      host: host._id,
      customer_id: customer._id
    }).exec(function(err,tasks){
      if (err) return done()
      if (!tasks||tasks.length===0) return done()
      //data.tasks = tasks

      const completed = lodash.after(tasks.length, done)

      tasks.forEach(task => {
        task.populateTriggers(() => {
          logger.log('processing triggers')
          logger.data('triggers %j', task.triggers)

          data.tasks.push(task)

          if (
            ! task.triggers ||
            ! Array.isArray(task.triggers) ||
            task.triggers.length===0
          ) {
            // if no triggers
            return completed()
          }

          detectTaskTriggersOfSameHost(task.triggers, host, (err,triggers) => {
            if (!err && triggers.length>0) {
              data.triggers.push({
                task: {
                  _id: task._id,
                  _type: task._type,
                  name: task.name,
                },
                task_id: task._id,
                events: triggers
              })

              // find trigger within task.triggers and remove
              triggers.forEach(trigger => {
                var index
                const elem = task.triggers.find((t,idx) => {
                  index = idx
                  return t._id === trigger.id 
                })

                if (elem !== undefined) {
                  task.triggers.splice(index, 1)
                }
              })
            }
            // At this point task.triggers should contain only triggers that :
            // 1. belongs to tasks and monitors of other hosts
            // 2. to webhooks 
            // 3. other external events and sources (not implemented yet)
            // Triggers of same host should be "templatized"
            completed()
          })
        })
      })
    })
  }

  logger.log('getting resources config')
  resourcesConfig(()=>{
    logger.log('getting tasks config')
    tasksConfig(()=>{
      logger.log('data fetched')
      next(null,data)
    })
  })
}

/**
 * @summary Register a new host
 * @author Facugon
 * @param {Object} input
 * @param {String} input.hostname
 * @param {Customer} input.customer
 * @param {User} input.user
 * @param {Object} input.info
 * @property {String} input.info.agent_version
 * @property {String} input.info.ip
 * @property {String} input.info.os_name
 * @property {String} input.info.os_version
 * @property {String} input.info.state
 * @param {Function(Error,Object)} next
 */
HostService.register = (input,next) => {
  const hostname = input.hostname
  const customer = input.customer
  const info = input.info
  const user = input.user
  logger.log('registering new host "%s"', hostname);

  Host.create({
    customer_name: customer.name,
    customer_id: customer._id,
    creation_date: new Date(),
    last_update: new Date(),
    hostname: hostname,
    ip: info.ip,
    os_name: info.os_name,
    os_version: info.os_version,
    agent_version: info.agent_version,
    state: info.state
  }, (err, host) => {
    if (err) {
      logger.error(err)
      return next(err)
    }

    logger.log('host registered. creating host resource')

    const data = {
      user: user,
      host_id: host._id,
      hostname: host.hostname,
      customer: customer,
      customer_id: customer._id,
      customer_name: customer.name,
      name: host.hostname,
      type: 'host',
      monitor_type: 'host',
      enable: true,
      description: host.hostname
    }

    createHostResources(host, data, (err, payload) => {
      if (err) return next(err)
      next(null, payload)
    })
  })
}

/**
 * @deprecated
 */
HostService.fetchBy = (query,next) => {
  console.warn('DEPRECATE THIS. DO NOT USE AND REMOVE')

  logger.log('fetching hosts by customer %s',query.customer_name);

  Host.find(query,(err,hosts) => {
    if (err) {
      return next(err,null)
    }

    if (hosts.length===0) return next(null,[])

    logger.log('publishing hosts')
    var pub = []
    hosts.forEach((host,id) => {
      pub.push( host.publish() )
    })
    next(null,pub)
  })
}

HostService.disableHostsByCustomer = (customer, doneFn) => {
  Host 
  .find({ 'customer_id': customer._id })
  .exec(function(error, hosts){
    if(hosts.length != 0){
      for(var i=0; i<hosts.length; i++){
        var host = hosts[i];

        host.enable = false;
        host.save(function(error){
          if(error) {
            logger.error('ERROR updating host property');
            throw error;
          }
        });
      }
    }
  });
}


/**
 * Create a resource for the host, also 
 * clone from a template if matched or the basic dstat & psaux monitors.
 *
 * @summary Create host resources, orchestrate basic or template resources
 * @param {Host} host
 * @param {Object} data
 * @param {Function(Error,Object)} next
 */
const createHostResources = (host, data, next) => {
  ResourceService.create(data, (err, result) => {
    if (err) {
      logger.error(err)
      return next(err)
    }

    logger.log('host resource created')
    const resource = result.resource
    next(null, { host: host, resource: resource })

    HostGroupService.orchestrate(host, (err, groups) => {
      if (err) {
        logger.error(err)
        return
      }

      if (!groups||!Array.isArray(groups)||groups.length===0) {
        // create resources and notify agent
        createBaseMonitors(
          Object.assign({}, data, {
            host: host,
            resource: resource
          }),
          () => {
            AgentUpdateJob.create({ host_id: host._id })
          }
        )
      } else {
        AgentUpdateJob.create({ host_id: host._id })
      }
    })
  })
}

const sendEventNotification = (host,vent) => {
  var str = '[HIGH] :customer/:hostname :event';
  var subject = str
  .replace(':customer', host.customer_name)
  .replace(':hostname', host.hostname);

  switch (vent) {
    case 'agent_unreachable':
      subject = subject.replace(':event','unreachable');
      break;
    case 'agent_running':
      subject = subject.replace(':event','recovered');
      break;
  }

  var template = 'email/host/' + vent;
  var params = { 'hostname': host.hostname };

  Handlebars.render(template, params, function(content){
    CustomerService.getAlertEmails(host.customer_name,
    function(error,emails){
      NotificationService.sendEmailNotification({
        'to': emails.join(','),
        'customer_name': host.customer_name,
        'subject': subject,
        'content': content
      });
    });
  });

  NotificationService.sendSNSNotification({
    'resource': 'host',
    'event': vent,
    'customer_name': host.customer_name,
    'hostname': host.hostname
  },{
    'topic': 'events',
    'subject': 'host_update'
  });
}

/**
 * @summary create a dstats and psaux monitoring workers
 * @param {Object} input
 * @param {Function} next
 */
const createBaseMonitors = (input, next) => {
  logger.log('creating base monitors')
  next||(next = ()=>{})
  const dstat = Object.assign({},input,{type:'dstat'})
  const psaux = Object.assign({},input,{type:'psaux'})
  createMonitor([input.host._id], dstat, (err) => {
    if (err) logger.error(err)
    createMonitor([input.host._id], psaux, (err) => {
      if (err) logger.error(err)
      next()
    })
  })
}

/**
 *
 * Given an task, extract the triggers for monitors and tasks that belongs
 * to the same host of the task. Remove the triggers from the task
 *
 * A trigger belongs to a host, if the monitor or task that emit
 * the trigger belongs to the host.
 *
 * @param {Event[]} triggers array of task triggers, Event entities
 * @param {Host} host
 * @param {Function(Error,Array)} next
 * @return null
 *
 */
const detectTaskTriggersOfSameHost = (triggers, host, next) => {
  const asyncOps = []

  // pre-filter triggers data. should has been previously populated
  // if not valid object, skip
  const filteredTriggers = triggers.filter((event) => {
    return !(!event||!event._id)
  },[])

  if (filteredTriggers.length === 0) {
    return next(null,[])
  }

  // now get those of the same host
  async.filterSeries(
    filteredTriggers,
    (trigger, done) => {
      isHostEvent(trigger._id, host._id, (err,result) => {
        // on error report and ignore
        if (err) return done(null, false)
        done(null, result)
      })
    },
    (err, hostTriggers) => {
      if (err) return next(err,[])

      if (!Array.isArray(hostTriggers)||hostTriggers.length===0) {
        return next(null,[])
      }
      const data = hostTriggers.map(trigger => {
        return {
          id: trigger._id,
          _type: trigger._type,
          name: trigger.name,
          emitter_id: trigger.emitter._id,
          emitter: {
            _id: trigger.emitter._id,
            _type: trigger.emitter._type,
            name: trigger.emitter.name,
          }
        }
      })
      next(err, data)
    }
  )
}

/**
 * Detect if an event has an emitter that triggers a task on the same host
 * @param {ObjectId} event_id Event mongodb id
 * @param {ObjectId} host_id Host mongodb id
 * @param {Function} next callback
 */
const isHostEvent = (event_id, host_id, next) => {
  logger.log('fetching event %s', event_id)

  // use fetch instead of findById because fetch also populate
  // the correct emitter
  Event.fetch({ _id: event_id }, (err,events) => {
    if (err) return next(err)
    if (!events) return next(null, false)
    if (!Array.isArray(events)||events.length===0)
      return next(null, false)

    const event = events[0]
    if (!event.emitter) {
      var err = new Error('the event doesn\'t has an emitter')
      err.event = event
      logger.error(err)
      next(err, false)
    } else {
      if (!event.emitter.host_id) { // webhooks
        next(null,false)
      } else {
        // emitter.host_id and host_id are ObjectId's 
        next(null, Boolean(event.emitter.host_id.toString() === host_id.toString()))
      }
    }
  })
}
