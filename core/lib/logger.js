var debug = require('debug');
module.exports = function(name) {
  var dlog = debug('theeye:log:' + name);
  var derror = debug('theeye:error:' + name);
  var ddata = debug('theeye:data:' + name);
  var ddebug = debug('theeye:debug:' + name);
  var dwarn = debug('theeye:warn:' + name);

  return {
    log   : function flog(){ dlog.apply(this, arguments); },
    error : function ferror(){ derror.apply(this, arguments); },
    warn  : function fwarn(){ dwarn.apply(this, arguments); },
    data  : function fdata(){ ddata.apply(this, arguments); },
    debug : function fdebug(){ ddebug.apply(this, arguments); }
  };
}
