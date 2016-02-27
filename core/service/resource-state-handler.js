var TriggerService = require(process.env.BASE_PATH + '/service/trigger');
var ResourceEventLog = require(process.env.BASE_PATH + '/service/resource-event-log');
var Host = require( process.env.BASE_PATH + "/entity/host" ).Entity;
var CustomerService = require('./customer');

var name = 'eye:supervisor:service:resource-event-dispatcher';
var debug = require('../lib/logger')(name);

var format = require('util').format;

function ResourceStateHandler(resource,state_name)
{
  var self = this;
  self.resource = resource;
  self.state_name = state_name;
}

ResourceStateHandler.prototype = {
  setStateData : function(state_data)
  {
    this.state_data = state_data ;
    return this;
  },
  handleState : function(next)
  {
    var self = this;
    var resource = this.resource;
    var resource_state = this.state_name;

    TriggerService.find(
      resource_state,
      resource,
      function(error,trigger) {
        if(trigger == null) {
          debug.log(
            'There are no trigger for state name "%s" & resource "%s"',
            resource_state, 
            resource.name
          );
        } else {
          self.processStateEventTrigger(trigger,function(){
          });
        }

        next();
      }
    );
  },
  processStateEventTrigger : function(trigger,next)
  {
    var self = this;
    debug.log('Triggered state event "%s" on resource "%s"',
      trigger.resource_state,
      self.resource.name
    );

    CustomerService.getCustomerConfig(
      self.resource.customer_id, 
      function(error,config){
        switch( trigger.operating_mode )
        {
          case 'normal':
            self.processResourceNormalOperationEvent(trigger, config, self.resource);
            break;
          case 'failure':
            self.processResourceFailureOperationEvent(trigger, config, self.resource);
            break;
          case 'default':
            debug.error('resource operating mode not handled!');
            break;
        }
      });
  },
  processResourceFailureOperationEvent : function(trigger,config,resource,next)
  {
    var self = this ;
    var customer_name = resource.customer_name ;
    var state = trigger.resource_state;

    debug.error('resource "%s" failure.', resource.name);

    resource.fails_count++;
    debug.log(
      'resource %s fails count %s/%s', 
      resource.description, 
      resource.fails_count,
      config.fails_count_alert
    );

    if( resource.fails_count >= config.fails_count_alert )
    {
      // resource state changed
      if( resource.state != state )
      {
        debug.log(
          'sending resource failure alerts to customer %s', 
          customer_name
        );

        ResourceEventLog.log(resource,trigger);

        resource.state = state ;

        // service failure require inmediate attention
        if( resource.attend_failure ) {
          // trigger re-start action
          Host.findById(resource.host_id, function(error,host) {
            if(error) {
              debug.error('database access error.');
              debug.error(error);
            } else if(host == null) {
              debug.error('invalid host. not found');
              debug.error(resource);
            } else {
              TriggerService.processTask(trigger.task_id);
            }
          });
        }

        var content = format('resource "%s" is "%s"',resource.name,state);

        CustomerService.getAlertEmails(customer_name,function(emails){
          NotificationService.sendEmailNotification({
            to : emails.join(','),
            customer_name : customer_name,
            subject : '[ALERT] %s service down'.replace('%s',customer_name),
            content : content
          });
        });

        NotificationService.sendSNSNotification({
          'state'        : state,
          'message'       : 'resource state has changed to "%s"'.replace(state),
          'customer_name' : customer_name,
          'service'       : resource.name,
          'id'            : resource._id,
          'hostname'      : resource.hostname,
          'type'          : 'resource'
        },{
          topicArn : 'arn:aws:sns:us-east-1:691060090647:events' ,
          subject : 'service_update' ,
          apiRoute : '/events/update'
        });
      }
    }
    self.service.save();
  },
  processResourceNormalOperationEvent : function(trigger,config,resource,next)
  {
  }
};

module.exports = ResourceStateHandler ;
