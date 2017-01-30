"use strict";

var WebhookEvent = require('../event').WebhookEvent;

module.exports = function (webhook) {
  WebhookEvent.remove({ emitter: webhook._id }, err => { });
}
