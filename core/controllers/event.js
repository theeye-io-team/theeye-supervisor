"use strict";

var resolver = require('../router/param-resolver');
var Event = require('../entity/event').Event;

var async = require('async');

module.exports = function (server, passport) {
  server.get('/:customer/event/:event',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'event' })
  ], controller.get);

  server.get('/:customer/event',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({})
  ], controller.fetch);
}

var controller = {
  get (req, res, next) {
    if( ! req.event ) req.send(404);
    req.send(200, req.event);
  },
  fetch (req, res, next) {
    Event
    .find({ customer: req.customer })
    .exec(function(err, events){
      // theres is a bug in mongoose with this schemas
      // populate within the find query does not work as expected
      async.each(
        events,
        (e, done) => e.populate({
          path: 'emitter',
          populate: {
            path: 'host',
            model: 'Host'
          }
        }, done),
        (err) => {
          if(err) res.send(500);
          res.send(200, events);
        }
      );
    });
  },
}
