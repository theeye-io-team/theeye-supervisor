"use strict";

var _ = require('lodash');
var Host = require("../../entity/host").Entity;
var Resource = require("../../entity/resource").Entity;
var NotificationService = require("../notification");
var CustomerService = require("../customer");
var Handlebars = require("../../lib/handlebars");
var ResourceService = require("../resource");
var HostGroupService = require('./group');
var AgentUpdateJob = require('../../entity/job').AgentUpdate;
var logger = require("../../lib/logger")("service:host");

var createMonitor = ResourceService.createResourceOnHosts;

function HostService(host) {
  var self = this;
  this.host = host ;
}

HostService.prototype = {
  agentUnreachable: function() {
    var self = this;
    var vent = 'agent_unreachable';
    var host = this.host;

    CustomerService.getCustomerConfig(
      host.customer_id,
      function(error,config){
        host.fails_count += 1;
        var maxFails = config.fails_count_alert;
        logger.log('fails count %d/%d', host.fails_count, maxFails);

        if( host.fails_count > maxFails ) {
          if( host.state != vent ) {
            logger.log('host "%s" state has changed to "%s"', host.hostname, vent);
            host.state = vent ;

            logger.log('processing "%s" event',vent);
            sendEventNotification(host,vent);
          }
        }

        host.save();
      }
    );
  },
  agentRunning:function()
  {
    var vent = 'agent_running' ;
    var host = this.host;

    if( host.state != vent )
    {
      logger.log('host "%s" state has changed to "%s"', host.hostname, vent);
      host.state = vent;
      host.fails_count = 0;
      host.save();

      logger.log('processing "%s" event',vent);
      sendEventNotification(host,vent);
    }
  },
};

function sendEventNotification (host,vent)
{
  var str = '[HIGH] :customer/:hostname :event';
  var subject = str
  .replace(':customer', host.customer_name)
  .replace(':hostname', host.hostname);

  switch(vent)
  {
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
* create a dstats and psaux monitoring workers
*/
function createBaseMonitors (input, doneFn){
  logger.log('creating base monitors');
  doneFn||(doneFn = ()=>{});
  let dstat = Object.assign({},input,{'type':'dstat'});
  let psaux = Object.assign({},input,{'type':'psaux'});
  createMonitor([input.host._id],dstat);
  createMonitor([input.host._id],psaux);
}

/**
*
* @author Facundo
*
* @param {String} hostname
* @param {Object} customer , a Customer object
* @param {Object} info
*    @property {String} agent_version
*    @property {String} ip
*    @property {String} os_name
*    @property {String} os_version
*    @property {String} state
* @param {Function} next callback
* @return null
*
*/
HostService.register = function(input,next) {
  var hostname = input.hostname;
  var customer = input.customer;
  var info = input.info;
  logger.log('registering new host "%s"', hostname);

  var data = {
    'hostname': hostname,
    'agent_version': info.agent_version || 'not_informed',
    'ip': info.ip || 'not_informed',
    'os_name': info.os_name || 'not_informed',
    'os_version': info.os_version || 'not_informed',
    'state': info.state || 'not_informed'
  };

  Host.create(
    data, 
    customer, 
    function(error, host){
      if(error) throw new Error('host registration error. ' + error.message);

      logger.log('host registered. creating host resource');

      var data = {
        'user':input.user,
        'host_id': host._id,
        'hostname': host.hostname,
        'customer': customer,
        'customer_id': customer._id,
        'customer_name': customer.name,
        'name': host.hostname,
        'type': 'host',
        'monitor_type':'host',
        'enable': true,
        'description': host.hostname
      };

      ResourceService.create(data,function(error, result){
        let resource = result.resource;
        logger.log('resource registered.');

        next(error,{'host':host,'resource':resource});

        data.host = host;
        data.resource = resource;
        HostGroupService.searchAndRegisterHostIntoGroup(host, (err,group)=>{
          if(err) return logger.error(err);
          if(!group) return createBaseMonitors(data);

          resource.template = group;
          resource.save();
          AgentUpdateJob.create({ host_id: host._id });
        });
      });
    }
  );
}

HostService.fetchBy = function(query,next) {
  logger.log('fetching hosts by customer %s',query.customer_name);

  Host.find(query,function(error,hosts){
    if(error) return next(error,null);
    var pub = [];
    hosts.forEach(function(host,id){
      pub.push( host.publish() );
    });
    next(null,pub);
  });
}

HostService.disableHostsByCustomer = function(customer, doneFn){
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

module.exports = HostService ;
