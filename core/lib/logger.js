var debug = require('debug');

module.exports = function(name) {
  var log = debug(name);
  var error = debug(name + ':error');
  var data = debug(name + ':data');

  function logFn() {
    log.apply(this, arguments);
  }

  function errorFn() {
    error.apply(this, arguments);
  }

  function dataFn() {
    data.apply(this, arguments);
  }

  return {
    log: logFn,
    error: errorFn,
    data: dataFn 
  };
};
