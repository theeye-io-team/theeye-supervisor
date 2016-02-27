var _ = require('lodash');
var debug = require('debug')('eye:core:deploy:20151016');

debug('this script is for attach monitors of type dstat and psaux, to resource type host if required');

require("../environment")
.setenv( process.env.NODE_ENV, function start(){

  var Host = require('../entity/host').Entity;
  var Resource = require('../entity/resource').Entity;
  var ResourceMonitor = require('../entity/resource-monitor').Entity;
  var ResourceMonitorService = require('../service/resource/monitor');
  var Job = require('../entity/job').Entity;

  function createHostMonitors(host, resource) {
    var input = {
      'host' : host,
      'resource' : resource,
      'host_id' : host._id,
      'hostname' : host.hostname,
      'customer_id' : host.customer_id,
      'customer_name' : host.customer_name,
      'name' : host.hostname + '_host',
      'type' : 'host',
      'description' : 'Resource for host ' + host.hostname,
    };  

    ResourceMonitorService.createMonitor('dstat', input,
      function(error,dstat){
        debug('resource "%s" dstat created', resource.description);
        ResourceMonitorService.createMonitor('psaux', input,
          function(error,psaux){
            debug('resource "%s" psaux created', resource.description);
            Job.createAgentConfigUpdate(host._id);
            debug('agent update job created');
            if(doneFn) doneFn();
          }
        );
      }
    );
  }; 

  function handleMonitorsResult (error, host, resource, monitors) {
    if(monitors.length == 0){
      debug('no monitor for resource "%s"', resource.description);
      debug('creating monitors');
      createHostMonitors(host, resource);
    }else{
      for(var z=0; z<monitors.length; z++){
        var monitor = monitors[z];
        debug('resource "%s" monitor "%s" type "%s"', 
          resource.description, 
          monitor.name, 
        monitor.type);
      };
    }
  }

  function searchResourceMonitors (resource, doneFn) {
    ResourceMonitor
      .find({ resource_id: resource._id })
      .exec(function(error, monitors){
        doneFn(error, resource, monitors);
      });
  }

  function processHostResources (host) {
    Resource
    .find({ host_id: host._id })
    .exec(function(error, resources){

      debug('hostname "%s"', host.hostname);

      for(var j=0; j<resources.length; j++){
        var resource = resources[j];
        debug('resource description "%s"', resource.description);

        if( resource.type === 'host' ){

          searchResourceMonitors(resource, function(error, resource, monitors){
            handleMonitorsResult(error, host, resource, monitors);
          });
        }
      }

    });
  }

  Host
  .find()
  .exec(function(error, hosts){

    for(var i=0; i<hosts.length; i++){

      var host = hosts[i];

      processHostResources(host);

    }
  });

});
