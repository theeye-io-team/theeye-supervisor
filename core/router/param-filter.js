"use strict";
var debug = require('debug')('eye:supervisor:router:param-filter-middleware');
var _ = require('lodash');

module.exports = {
  /**
   *
   * turn input into array
   * @author Facundo
   * @param {Mixed} value to filter
   * @return {Array} filtered value
   *
   */
  toArray (value) {
    if( Array.isArray( value ) ) {
      return value;
    } else {
      let isString = Object.prototype.toString.call( value ) === '[object String]';
      let isNumber = Object.prototype.toString.call( value ) === '[object Number]';
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
  uniq (value) {
    var isArray = Object.prototype.toString.call( value ) === '[object Array]';
    if( isArray ) return _.uniq( value );
    else return [ value ]; // unique value into an array
  },

  toBoolean (value) {
    if( value === true || value === 'true' ) return true;
    if( value === false || value === 'false' ) return false;
    return null;
  },
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
  spawn (options) {
    var name = options.param;
    var filterFn = options.filter;
  
    return (req, res, next) => {
  		let value = req[name] 
        || req.params[name] 
        || req.body[name] 
        || req.query[name];
  
      req[name] = this[filterFn](value);
      next();
    }
  }
}
