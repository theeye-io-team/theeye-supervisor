var debug = require('debug')('eye:supervisor:router:param-validator-middleware');

module.exports = {
  'isMongoId': isMongoId,
  'isRecomendedFilename':isRecomendedFilename,
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
function isRecomendedFilename(filename){
  if(!filename) return true;
  return filenameRegexp.test(filename);
}

