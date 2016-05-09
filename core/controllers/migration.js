"use strict";
var MonitorService = require('../service/resource/monitor');
var ResourceService = require('../service/resource');
var ResourceMonitorService = require('../service/resource/monitor');
var HostGroupService = require('../service/host/group');

var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var HostGroup = require('../entity/host/group').Entity;
var _ = require('lodash');

var createMonitor = ResourceService.createResourceAndMonitorForHost;

module.exports = function(server){
  server.get('/create_host_monitors',[
    //passport.authenticate('bearer',{session:false}),
  ],controller.createHostMonitors);

  server.get('/create_dstat_psaux_resources',[
    //passport.authenticate('bearer',{session:false}),
  ],controller.createBaseResources);

  server.get('/create_missing_dstat_psaux_on_templates', [
  ],controller.addDstatPsauxToTemplates);
};

function createMonitorTypeHost(done){
  Resource.find({
    'type':'host'
  },function(err,resources){
    var created = _.after(resources.length,()=>done());
    resources.forEach(function(resource){
      var input = _.assign({},resource.toObject(),{'resource':resource});
      MonitorService.createMonitor('host', input, (err)=>created());
    });
  });
}

function removeAllDstatPsaux(done){
  ResourceMonitor.remove({'type':'dstat'},(err)=>{
    if(err) return done(err);
    ResourceMonitor.remove({'type':'psaux'},(err)=>{
      if(err) return done(err);
      console.log('done removing');
      done();
    });
  });
}

function createHostsDstatPsaux(done){
  Host.find(function(err,hosts){
    hosts.forEach(function(host){
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
    done();
  });
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
      //createHostsDstatPsaux((err)=>{
      //  if(err) return res.send(500);
        res.send(200);
      //});
    });
  },
  addDstatPsauxToTemplates(req,res)
  {
    HostGroup.find(function(err,groups){
      groups.forEach(function(group){
        var customer = {
          'name':group.customer_name,
          '_id':group.customer
        };
        var user = null;
        ResourceMonitorService
        .resourceMonitorsToTemplates(
          [ dstatConfig ],
          customer,
          user,
          (err,templates)=>{
            if(err){
              return console.log(err);
            }
            HostGroupService.Monitor.addTemplateToGroup(
              group, templates[0], ()=>{}
            );
          }
        );
      });
    });
    return res.send(200);
  }
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
