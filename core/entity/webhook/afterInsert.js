"use strict";

var WebhookEvent = require('../event').WebhookEvent;
var config = require('config');

module.exports = function (webhook) {

  var event = new WebhookEvent({
    name: 'trigger',
    customer: webhook.customer,
    emitter: webhook,
    emitter_id: webhook._id,
  });

  event.save(err => {});

}
