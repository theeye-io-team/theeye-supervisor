"use strict";
var MonitorService = require('../service/resource/monitor');
var ResourceService = require('../service/resource');
var ResourceMonitorService = require('../service/resource/monitor');
var HostGroupService = require('../service/host/group');

var Task = require('../entity/task').Entity;
var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var HostGroup = require('../entity/host/group').Entity;
var _ = require('lodash');

var createMonitor = ResourceService.createResourceAndMonitorForHost;

module.exports = function(server){
/**
  server.get('/create_host_monitors',[
    //passport.authenticate('bearer',{session:false}),
  ],controller.createHostMonitors);

  server.get('/create_dstat_psaux_resources',[
    //passport.authenticate('bearer',{session:false}),
  ],controller.createBaseResources);

  server.get('/create_missing_dstat_psaux_on_templates', [
  ],controller.addDstatPsauxToTemplates);

  server.get('/rebuild_hostgroups', [
  ],controller.relinkHostResourcesToGroups);
  */
};

function createMonitorTypeHost(done){
  Resource.find({
    'type':'host'
  },function(err,resources){
    var created = _.after(resources.length,()=>done());
    resources.forEach(function(resource){
      ResourceMonitor.find({
        'type':'host',
        'host_id':resource.host_id
      },function(err,monitors){
        if(monitors.length!=0) return created();
        var input = _.assign({},resource.toObject(),{'resource':resource});
        MonitorService.createMonitor('host', input, (err)=>created());
      });
    });
  });
}

function removeAllDstatPsaux(done){
  ResourceMonitor.remove({'type':'dstat'},(err)=>{
    if(err) return done(err);
    Resource.remove({'type':'dstat'},(err)=>{
      if(err) return done(err);
      ResourceMonitor.remove({'type':'psaux'},(err)=>{
        if(err) return done(err);
        Resource.remove({'type':'psaux'},(err)=>{
          if(err) return done(err);
          done();
        });
      });
    });
  });
}

function createHostsDstatPsaux(done){
  Host.find(function(err,hosts){
    hosts.forEach(function(host){
      // process host resource but 
      // only if template=null
      Resource.find({
        'type':'host',
        'template':null,
        'host_id':host._id
      },function(err,resources){
        // ignore thoese with template
        if(resources.length==0) return;
        var resource = resources[0];
        let dstat = Object.assign({},host.toObject(),{
          'host_id':host._id,
          'name':'dstat',
          'monitor_type':'dstat',
          'description':'host stats',
        });
        delete dstat._id;
        createMonitor(dstat);

        let psaux = Object.assign({},host.toObject(),{
          'host_id':host._id,
          'name':'psaux',
          'monitor_type':'psaux',
          'description':'host process',
        });
        delete psaux._id;
        createMonitor(psaux);
      });
    });
  });
  done();
}

function removeMonitorsAndTasksLinkedToTemplates(done){
  var query = { 'template':{$ne:null} };
  // remove tasks linked to templates
  Task.remove(query,err=>{
    // remove monitors linked to templates
    ResourceMonitor.remove(query,err=>{
      // remove resources linked to templates
      query['type'] = {$ne:'host'};
      Resource.remove(query,err=>{
        Resource.find({type:'host'},function(err,hosts){
          hosts.forEach(function(host){
            host.template=null;
            host.save();
          });
        });
        done()
      });
    });
  });
}

function createDstatPsaux (group){
  var customer = {
    'name':group.customer_name,
    '_id':group.customer
  };
  var user = null;
  ResourceMonitorService
  .resourceMonitorsToTemplates(
    [ dstatConfig, psauxConfig ],
    customer,
    user,
    function(err,templates){
      if(err) return console.log(err);
      HostGroupService
      .Monitor
      .addTemplatesToGroup(
        group, templates
      );
    }
  );
}

var controller = {
  createHostMonitors (req,res) {
    createMonitorTypeHost(()=>{
      res.send();
    });
  },
  createBaseResources (req,res) {
    removeAllDstatPsaux((err)=>{
      if(err) return res.send(500);
      createHostsDstatPsaux((err)=>{
        if(err) return res.send(500);
        res.send(200);
      });
    });
  },
  addDstatPsauxToTemplates(req,res) {
    HostGroup.find((err,groups)=>{
      groups.forEach(function(group){
        createDstatPsaux(group);
      });
    });
    return res.send(200);
  },
  relinkHostResourcesToGroups (req,res) {
    var unlinkOnly = req.params.unlink_only;

    res.send('processing');
    removeMonitorsAndTasksLinkedToTemplates(function(){
      console.log('templates unlinked');
      if(unlinkOnly) return;
      // search all hosts
      Host.find(function(err,hosts){
        hosts.forEach(function(host){
          HostGroupService.searchAndRegisterHostIntoGroup(
            host,function(err,group){
              if(group){
                Resource.find({
                  type:'host',
                  host_id:host._id
                },function(err,resources){
                  var resource = resources[0];
                  resource.template = group;
                  resource.save();
                });
              }
            }
          );
        });
      });
    });
  },
};

var dstatConfig = {
  _type: 'monitor',
  monitor_type: 'dstat',
  description: 'Host Stats',
  looptime: '30000'
};

var psauxConfig = {
  _type: 'monitor',
  monitor_type: 'psaux',
  description: 'Host Process',
  looptime: '30000'
};
