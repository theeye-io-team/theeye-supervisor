const ObjectId = require('mongoose').Schema.Types.ObjectId
const logger = require('../../lib/logger')('eye:entity:resource:template')
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')

const TemplateSchema = new BaseSchema({
  source_model_id: { type: ObjectId }, // if provided, is a reference to the source model. beware, won't be valid forever (eg. if the source model is deleted)
  hostgroup: { type: ObjectId, ref: 'HostGroup' }, // belongs to
  hostgroup_id: { type: ObjectId, required: true },
  monitor_template: { type: ObjectId, ref: 'MonitorTemplate' }, // has one
  monitor_template_id: { type: ObjectId, required: true },
  _type: { type: String, 'default': 'ResourceTemplate' }
},{ collection: 'resource_templates' })

TemplateSchema.methods.updateInstancesOfGroupHosts = function (done) {
  var template = this;
  logger.log('updating template resource "%s"(%s) instances',
    template.name,
    template._id
  )
  done()
}

var Entity = mongodb.model('ResourceTemplate', TemplateSchema);
exports.Entity = Entity;
