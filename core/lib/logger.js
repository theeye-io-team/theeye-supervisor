var debug = require('debug');

module.exports = function(name) {
  var log = debug(name);
  var error = debug(name + ':error');

  function logFn() {
    log.apply(this, arguments);
  }

  function errorFn() {
    error.apply(this, arguments);
  }

  return {
    log: logFn,
    error: errorFn
  };
};
