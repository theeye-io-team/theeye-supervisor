
const IndicatorConstants = require('../../constants/indicator')
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

const CounterSchema = new BaseSchema({
  value: { type: Number, default: 0 },
  type: { type: String, default: 'counter' }
})

const TextSchema = new BaseSchema({
  value: { type: String, default: '' },
  type: { type: String, default: 'text' }
})

const HTMLSchema = new BaseSchema({
  value: { type: String, default: '' },
  type: { type: String, default: 'html' }
})

const ChartSchema = new BaseSchema({
  value: { type: Object, default: () => { return {} } },
  type: { type: String, default: 'chart' }
})

const FileSchema = new BaseSchema({
  value: { type: String, default: '' },
  type: { type: String, default: 'file' }
})

const Indicator = mongodb.model('Indicator', IndicatorSchema)
const ProgressIndicator = Indicator.discriminator('ProgressIndicator', ProgressSchema)
const TextIndicator = Indicator.discriminator('TextIndicator', TextSchema)
const HTMLIndicator = Indicator.discriminator('HTMLIndicator', HTMLSchema)
const CounterIndicator = Indicator.discriminator('CounterIndicator', CounterSchema)
const ChartIndicator = Indicator.discriminator('ChartIndicator', ChartSchema)
const FileIndicator = Indicator.discriminator('FileIndicator', FileSchema)

const m2s = require('mongoose-to-swagger');
const fs = require('fs')

const swaggermodels = {
  components: {
    schemas: {
      Indicator: m2s(Indicator),
      ProgressIndicator: m2s(ProgressIndicator),
      CounterIndicator: m2s(CounterIndicator),
      TextIndicator: m2s(TextIndicator),
      HTMLIndicator: m2s(HTMLIndicator),
      ChartIndicator: m2s(ChartIndicator),
      FileIndicator: m2s(FileIndicator)
    }
  }
}

//fs.writeFileSync('./swagger.json', JSON.stringify(swaggermodels))

Indicator.ensureIndexes()
CounterIndicator.ensureIndexes()
ProgressIndicator.ensureIndexes()
TextIndicator.ensureIndexes()
HTMLIndicator.ensureIndexes()
ChartIndicator.ensureIndexes()
FileIndicator.ensureIndexes()

// called for both inserts and updates
Indicator.on('afterSave', function (model) {
  model.last_update = new Date()
  // do more stuff
})

const IndicatorFactory = function (attrs) {
  if (attrs.type === IndicatorConstants.SHORT_TYPE_CHART) {
    return new ChartIndicator(attrs)
  }
  if (attrs.type === IndicatorConstants.SHORT_TYPE_PROGRESS) {
    return new ProgressIndicator(attrs)
  }
  if (attrs.type === IndicatorConstants.SHORT_TYPE_TEXT) {
    return new TextIndicator(attrs)
  }
  if (attrs.type === IndicatorConstants.SHORT_TYPE_HTML) {
    return new HTMLIndicator(attrs)
  }
  if (attrs.type === IndicatorConstants.SHORT_TYPE_COUNTER) {
    return new CounterIndicator(attrs)
  }
  if (attrs.type === IndicatorConstants.SHORT_TYPE_FILE) {
    return new FileIndicator(attrs)
  }
  return new Indicator(attrs)
}

exports.Factory = IndicatorFactory
exports.Indicator = Indicator
exports.Progress = ProgressIndicator
exports.Counter = CounterIndicator
exports.Text = TextIndicator
exports.HTML = HTMLIndicator
exports.Chart = ChartIndicator
exports.File = FileIndicator
