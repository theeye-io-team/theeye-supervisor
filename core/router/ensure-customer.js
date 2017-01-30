'use strict';

module.exports = function (req,res,next) {
  var customer = req.customer;
  var user = req.user;

  if (!customer) {
    var err = new Error('customer is yet not present or not initialized in the request');
    err.statusCode = 500;
    next(err);
  }

  if (!user) {
    var err = new Error('user is yet not present or not initialized in the request');
    err.statusCode = 500;
    next(err);
  }

  if (user.credential==='root') {
    next();
  }

  var idx = user.customers
    .map( c => { return c.name })
    .indexOf( customer.name );

  if (idx === -1) {
    var err = new Error('you are not allowed to access this organization');
    err.statusCode = 403;
    return next( err );
  }

  return next();
}
