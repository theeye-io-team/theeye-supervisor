
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')

// this is the base indicator schema
const IndicatorSchema = new BaseSchema({
  _type: { type: String, default: 'Indicator' }
})

const ProgressSchema = new BaseSchema({
  value: { type: Number, default: 0 },
  type: { type: String, default: 'progress' }
})

const TextSchema = new BaseSchema({
  value: { type: String, default: '' },
  type: { type: String, default: 'text' }
})

const Indicator = mongodb.model('Indicator', IndicatorSchema)
const ProgressIndicator = Indicator.discriminator('ProgressIndicator', ProgressSchema)
const TextIndicator = Indicator.discriminator('TextIndicator', TextSchema)

Indicator.ensureIndexes()
ProgressIndicator.ensureIndexes()
TextIndicator.ensureIndexes()

// called for both inserts and updates
Indicator.on('afterSave', function (model) {
  model.last_update = new Date()
  // do more stuff
})

const IndicatorFactory = function (attrs) {
  if (attrs.type === 'progress') {
    return new ProgressIndicator(attrs)
  }
  if (attrs.type === 'text') {
    return new TextIndicator(attrs)
  }
  return new Indicator(attrs)
}

exports.Factory = IndicatorFactory
exports.Indicator = Indicator
exports.Progress = ProgressIndicator
exports.Text = TextIndicator
