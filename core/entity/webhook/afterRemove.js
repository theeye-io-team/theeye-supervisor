
var WebhookEvent = require('../event').WebhookEvent;

module.exports = function (webhook) {
  WebhookEvent.remove({ emitter_id: webhook._id }, err => { });
}
