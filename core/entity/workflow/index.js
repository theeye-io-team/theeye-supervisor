"use strict";

const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('../base-schema');
const Schema = require('mongoose').Schema;

const Edge = mongodb.model('Edge',
  new BaseSchema({
    _type: { type: String, 'default': 'Edge' },
    label: { type: String, 'default': 'Edge' },
    start: { type: Object, required:true },
    end: { type: Object, required:true }
  },{
    collection: 'workflow'
  });
);
Edge.on('afterSave', function(model){
  model.last_update = new Date();
});
Edge.ensureIndexes();

const ObserverTaskEdge = Edge.discriminator(
  'ObserverTaskEdge',
  new BaseSchema({
    start: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    end: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    }
  })
);

const ObservableTaskEdge = Edge.discriminator(
  'ObservableTaskEdge',
  new BaseSchema({
    start: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    end: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    }
  })
);

const ObservableMonitorEdge = Edge.discriminator(
  'ObservableMonitorEdge',
  new BaseSchema({
    start: {
      type: Schema.Types.ObjectId,
      ref: 'ResourceMonitor',
      required: true
    },
    end: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    }
  })
);

const ObservableWebhookEdge = Edge.discriminator(
  'ObservableWebhookEdge',
  new BaseSchema({
    start: {
      type: Schema.Types.ObjectId,
      ref: 'Webhook',
      required: true
    },
    end: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    }
  })
);

exports.Edge = Edge;
exports.ObserverTaskEdge = ObserverTaskEdge;
exports.ObservableTaskEdge = ObservableTaskEdge;
exports.ObservableMonitorEdge = ObservableMonitorEdge;
exports.ObservableWebhookEdge = ObservableWebhookEdge;
