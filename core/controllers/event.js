"use strict";

var appRoot = require('app-root-path');
var resolver = require('../router/param-resolver');
var Event = require('../entity/event').Event;

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
    .populate({
      path: 'emitter',
      populate: {
        path: 'host',
        model: 'Host'
      }
    })
    .exec(function(err, events){
      if(err) res.send(500);
      res.send(200, events);
    });
  },
}
