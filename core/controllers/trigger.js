"use strict";

var resolver = require('../router/param-resolver');

module.exports = function (server, passport) {
  /*
  server.get('/:customer/trigger/:event',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param:'event' })
  ], controller.emitEvent);

  server.post('/:customer/trigger/:event/key/:key',[
    //passport.authenticate('event-key', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param:'event' })
  ], controller.emitEvent);
*/
}

var controller = {
  emitEvent (req, res, next) {
  }
}
