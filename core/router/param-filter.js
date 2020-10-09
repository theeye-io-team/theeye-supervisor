'use strict';

const uniq = require('lodash/uniq');
const isEmail = require('validator/lib/isEmail');

module.exports = {
  emailArray (value) {
    var emails = this.toArray(value);
    if (emails.length===0) { return emails; }
    return emails.filter( email => {
      return isEmail(email);
    });
  },
  /**
   *
   * turn input into array
   * @author Facundo
   * @param {Mixed} value to filter
   * @return {Array} filtered value
   *
   */

  toArray (value) {
    if (Array.isArray(value)) {
      return value;
    } else {
      var isString = Object.prototype.toString.call(value) === '[object String]';
      var isNumber = Object.prototype.toString.call(value) === '[object Number]';
      if (isString || isNumber) return [value];
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
    var isArray = Object.prototype.toString.call(value) === '[object Array]';
    if (isArray) return uniq(value);
    else return [value]; // unique value into an array
  },
  toBoolean (value) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
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
    var self = this;

    var name = options.param;
    var filterFn = options.filter;

    return function (req, res, next) {
      var value = req[name]||req.params[name]||req.body[name]||req.query[name];
      req[name] = self[filterFn](value);
      next();
    };
  },
};
