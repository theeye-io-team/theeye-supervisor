"use strict";
var format = require('util').format;

var resources = {
  'dstat': { type: 'dstat', priority: 'LOW',
    events:[{
      name: 'host:stats:cpu:high',
      message: function(resource, event_data){
        var body = `cpu check failed. ${event_data.cpu}% CPU in use`;
        return body;
      }
    },{
      name: 'host:stats:mem:high',
      message: function(resource, event_data){
        var body = `mem check failed. ${event_data.mem}% MEM in use`;
        return body;
      }
    },{
      name: 'host:stats:cache:high',
      message: function(resource, event_data){
        var body = `cache check failed. ${event_data.cache}% CACHE in use`;
        return body;
      }
    },{
      name: 'host:stats:disk:high',
      message: function(resource, event_data){
        var disks = event_data.disk;
        var body = `disks check failed.`;
        return body;
      }
    }]
  },
  'psaux': { type: 'psaux', priority: 'LOW', events: [] },
  'host': { type: 'host', priority: 'HIGH', events: [] },
  'process': { type: 'process', priority: 'HIGH', events: [] },
  'script': { type: 'script', priority: 'HIGH', events: [] },
  'service': { type: 'service', priority: 'HIGH', events: [] }
};

module.exports = function (
  resource,
  event_name,
  event_data,
  done
){
  var type = resource.type;
  if( resources.hasOwnProperty(type) )
  {
    var value = resources[type];
    var events = value.events;
    if(events.length == 0 || !event_name){
      var body = `${resource.description} checks failed`;
      return body;
    } else {
      for(var i=0; i<events.length; i++){
        var evnt = events[i];
        if(evnt.name == event_name){
          return done(evnt.message(resource, event_data));
        }
      }
    }
  }
}
