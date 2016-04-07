var format = require('util').format;

var resources = {
  'host': {
    type: 'host',
    priority: 'LOW',
    events:[{
      name: 'host:stats:cpu:high',
      subject: '',
      message: function(resource, event_data){
        return format('host %s check fails.<br/> cpu usage is too high<br/> cpu %%s',
          resource.description, event_data.cpu.toFixed(2));
      }
    },{
      name: 'host:stats:mem:high',
      subject: '',
      message: function(resource, event_data){
        return format('host %s check fails.<br/> memory usage is too high<br/> mem %%s',
          resource.description, event_data.mem.toFixed(2));
      }
    },{
      name: 'host:stats:cache:high',
      subject: '',
      message: function(resource, event_data){
        return format('host %s check fails.<br/> cache usage is too high<br/> cache %%s',
          resource.description, event_data.cache.toFixed(2));
      }
    },{
      name: 'host:stats:disk:high',
      subject: '',
      message: function(resource, event_data){
        var disks = event_data.disk;
        var msg = format('host %s check fails.<br/> disk usage is too high<br/><ul>',
        resource.description);

        disks.forEach(function(disk){
          msg += format('<li>%s : %%d</li>', disk.name, disk.value.toFixed(2));
        });

        return msg + '</ul>';
      }
    }]
  },
  'process': {
    type: 'process',
    priority: 'HIGH',
    events: []
  },
  'script': {
    type: 'script',
    priority: 'HIGH',
    events: []
  },
  'service': {
    type: 'service',
    priority: 'HIGH',
    events: []
  }
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
      return done(format('resource "%s" checks failed', resource.description));
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
