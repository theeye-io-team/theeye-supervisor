"use strict";

const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');

var WF = mongodb.model('Workflow',
  new BaseSchema({
    _type: { type: String, 'default': 'Workflow' },
    graph: [{ type: Object }]
  })
);

WF.ensureIndexes();
WF.on('afterSave', function(model){
  model.last_update = new Date();
});

exports.Workflow = WF;
