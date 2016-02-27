var debug = require('debug')('eye:supervisor:router:param-filter-middleware');
var _ = require('lodash');

var filter = {
  /**
   *
   * turn input into array
   * @author Facundo
   * @param {Mixed} value to filter
   * @return {Array} filtered value
   *
   */
  toArray : function (value) {
    if( Array.isArray( value ) ) {
      return value;
    } else {
      var isString = Object.prototype.toString.call( value ) === '[object String]';
      var isNumber = Object.prototype.toString.call( value ) === '[object Number]';
      if( isString || isNumber ) return [ value ];
      else return []; // invalid or undefined
    }
  },
  /**
   *
   * remove duplicated elements from input array
   * @author Facundo
   * @param {Mixed} value to filter
   * @return {Array} filtered value
   *
   */
  uniq : function  (value) {
    var isArray = Object.prototype.toString.call( value ) === '[object Array]';
    if( isArray ) return _.uniq( value );
    else return [ value ]; // unique value into an array
  }
}

module.exports = {
  'spawn' : spawn ,
  'toArray' : filter.toArray ,
  'uniq' : filter.uniq ,
}

/**
 *
 * call with param and and filter funtion name
 * @param {Object} options
 * > @param {String} param , request parameter name (query, param, body or req[name] allowed)
 * > @param {String} filter , supported filter function name
 *
 * @return {Function} middleware interface function
 *
 */
function spawn (options) {
  var name = options.param;
  var filterFn = options.filter;

  return function(req, res, next){
		var value = req[name] 
      || req.params[name] 
      || req.body[name] 
      || req.query[name];

    req[name] = filter[filterFn](value);
    next();
  }
}

