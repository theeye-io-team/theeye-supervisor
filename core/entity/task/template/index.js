'use strict'

const mongodb = require('../../../lib/mongodb').db

const TemplateSchema = require('./schema')
const ScriptSchema = require('./script')
const ScraperSchema = require('./scraper')
const ApprovalSchema = require('./approval')
const DummySchema = require('./dummy')
const NotificationSchema = require('./notification')

const Template = mongodb.model('TaskTemplate', new TemplateSchema())
const ScriptTemplate = Template.discriminator('ScriptTaskTemplate', ScriptSchema)
const ScraperTemplate = Template.discriminator('ScraperTaskTemplate', ScraperSchema)
const ApprovalTemplate = Template.discriminator('ApprovalTaskTemplate', ApprovalSchema)
const DummyTemplate = Template.discriminator('DummyTaskTemplate', DummySchema)
const NotificationTemplate = Template.discriminator('NotificationTaskTemplate', NotificationSchema)

Template.ensureIndexes()
ScriptTemplate.ensureIndexes()
ScraperTemplate.ensureIndexes()
ApprovalTemplate.ensureIndexes()
DummyTemplate.ensureIndexes()
NotificationTemplate.ensureIndexes()


// called for both inserts and updates
Template.on('beforeSave', function(model) {
  model.last_update = new Date()
  // do more stuff
})

exports.Template = Template
exports.ScriptTemplate = ScriptTemplate
exports.ScraperTemplate = ScraperTemplate
exports.ApprovalTemplate = ApprovalTemplate
exports.DummyTemplate = DummyTemplate
exports.NotificationTemplate = NotificationTemplate
