var debug = require('debug')('eye:router:middleware:params-validator');

module.exports = {
  'isMongoId': isMongoId,
  'isValidFilename':isValidFilename,
  'isEmail': isEmail,
}

var emailRegex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i ;
/**
 *
 */
function isEmail (value)
{
  if(!value) return false;
  return emailRegex.test(value);
}

var mongoidRegexp = /^[a-fA-F0-9]{24}$/;
/**
 *
 */
function isMongoId (value) {
  if(!value) return false;
  return mongoidRegexp.test(value) ;
}

var filenameRegexp = /^[0-9a-zA-Z-_.]*$/;
/**
 *
 */
function isValidFilename(filename){
  if(!filename) return true;
  return filenameRegexp.test(filename);
}

