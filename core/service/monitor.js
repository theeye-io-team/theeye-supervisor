var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var ResourceService = require('./resource');
var CustomerService = require('./customer');
var HostService = require('./host');
var debug = require('../lib/logger')('eye:supervisor:service:monitor');

var config = require('config');

module.exports = {
  start : function()
  {
    setInterval(
      this.checkResourcesState,
      config.get('monitor').resources_check_failure_interval_milliseconds
    );

    setInterval(
      this.checkHostsResourcesState,
      config.get('monitor').resources_check_failure_interval_milliseconds
    );
  },
  checkHostsResourcesState : function()
  {
    debug.log('<<<<< checking hosts resources state >>>>>');
    // Agent core worker for sending keep alive, has fixed looptime for every customer/agent
    var looptime = config.get('agent').core_workers.host_ping.looptime;
    var timeLimit = config.get('monitor').resources_alert_failure_threshold_milliseconds;
    var threshold = looptime + timeLimit ;
    var nowTime = Date.now();

    Resource.find({
      'enable': true,
      'type': 'host'
    },function(err,resources){
      for(var i=0; i<resources.length; i++){
        var resource = resources[i];
        CustomerService.getCustomerConfig(
          resource.customer_id,
          function(error,customerConfig){
            if(error) return debug.error('Retrive customer config error : %s', error.message);

            var lastUpdate = nowTime - resource.last_update.getTime() ;
            if( lastUpdate > threshold ) // milliseconds comparation
            {
              var loops = Math.floor(lastUpdate / looptime);
              if( loops > resource.fails_count ) // if higher then inc. fails count
              {
                var manager = new ResourceService(resource);
                manager.handleState({
                  'state' : 'updates_stopped',
                  'last_check': Date.now()
                });
              }
            }
          }
        );
      }
    });
  },
  checkResourcesState : function()
  {
    debug.log('<<<<< checking resources state >>>>>');

    Resource.find({
      'enable': true 
    },function(err,resources){
      var nowTime = Date.now(); // milliseconds

      for(var i=0; i<resources.length; i++){
        var resource = resources[i];

        ResourceMonitor.findOne({
          'enable': true,
          'resource_id' : resource._id 
        }, function(error,monitor) {
          if(error) return debug.error('Resource monitor query error : %s', error.message);
          if(!monitor) return;

          CustomerService.getCustomerConfig(
            resource.customer_id,
            function(error,customerConfig){
              if(error) return debug.error('Retrive customer config error : %s', error.message);

              // EVERY TIME OPERATION HERE IS PERFORMED IN MILLISECONDS
              var threshold = monitor.looptime + customerConfig.resources_alert_failure_threshold_milliseconds ;
              var lastUpdate = nowTime - resource.last_update.getTime() ;
              if( lastUpdate > threshold ) // milliseconds comparison
              {
                // how many loops come into the time passed
                // since last resource state update received
                var loops = Math.floor(lastUpdate / monitor.looptime);
                if( loops > resource.fails_count ) // if higher then inc. fails count
                {
                  var manager = new ResourceService(resource);
                  manager.handleState({
                    'state': 'updates_stopped',
                    'last_check': Date.now()
                  });
                }
              }
            });
        });
      }
    });
  }
};
