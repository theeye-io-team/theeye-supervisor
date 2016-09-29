"use strict";

var WebhookEvent = require('../event').WebhookEvent;
var elastic = require('../../lib/elastic');
var config = require('config');

module.exports = function (webhook) {

  var event = new WebhookEvent({
    name: 'trigger',
    customer: webhook.customer,
    emitter: webhook
  });
  event.save(err => {});

}
