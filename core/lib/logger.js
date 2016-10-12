var debug = require('debug');
module.exports = function(name) {
  return {
    log: function(){ debug('theeye:log:' + name).apply(this, arguments); },
    error: function(){ debug('theeye:error:' + name).apply(this, arguments); },
    data: function(){ debug('theeye:data:' + name).apply(this, arguments); },
    debug: function(){ debug('theeye:debug:' + name).apply(this, arguments); }
  };
};
