'use strict';
var exec = require('child_process').exec;
var config = require('config');
module.exports = function(next) {
  var version = config.server.version;
  if (!version) {
    var cmd = 'cd ' + process.cwd() + ' && git describe';
    exec(cmd,{},function(error,stdout,stderr){
      version = (error||stderr) ? 'unknown' : stdout;
      next(null,version);
    });
  }
  else return next(null,version);
}
