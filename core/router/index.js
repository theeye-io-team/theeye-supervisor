"use strict";

var logger = require('../lib/logger')(':router');
var config = require('config');
var fs = require("fs");
var join = require("path").join;

module.exports = {
  loadControllers: function(server, passport) {
    logger.log('loading controllers');
    // avoiding dynamic linker
    require('../controllers/agent-config')(server,passport);
    require('../controllers/agent')(server,passport);
    require('../controllers/customer')(server,passport);
    require('../controllers/dstat')(server,passport);
    require('../controllers/event')(server,passport);
    require('../controllers/host-stats')(server,passport);
    require('../controllers/host')(server,passport);
    require('../controllers/hostgroup-monitor')(server,passport);
    require('../controllers/hostgroup-task')(server,passport);
    require('../controllers/hostgroup')(server,passport);
    require('../controllers/job')(server,passport);
    require('../controllers/psaux')(server,passport);
    require('../controllers/resource-monitor')(server,passport);
    require('../controllers/resource-type')(server,passport);
    require('../controllers/resource')(server,passport);
    require('../controllers/script-download')(server,passport);
    require('../controllers/script')(server,passport);
    require('../controllers/tags')(server,passport);
    require('../controllers/task-schedule')(server,passport);
    require('../controllers/task')(server,passport);
    require('../controllers/user')(server,passport);
    require('../controllers/webhook')(server,passport);
    require('../controllers/workflow')(server,passport);
  },
  resolve: require('./param-resolver'),
  filter: require('./param-filter'),
  userCustomer: require('./user-customer'),
}
