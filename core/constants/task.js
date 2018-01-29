
exports.TYPE_SCRIPT = 'script'
exports.TYPE_SCRAPER = 'scraper'

const ARGUMENT_TYPE_FIXED = 'fixed'
const ARGUMENT_TYPE_INPUT = 'input'
const ARGUMENT_TYPE_SELECT = 'select'

exports.ARGUMENT_TYPE_FIXED = ARGUMENT_TYPE_FIXED
exports.ARGUMENT_TYPE_INPUT = ARGUMENT_TYPE_INPUT
exports.ARGUMENT_TYPE_SELECT = ARGUMENT_TYPE_SELECT

exports.ARGUMENT_TYPES = Object.freeze([
  { id: ARGUMENT_TYPE_FIXED, text: 'Fixed' },
  { id: ARGUMENT_TYPE_INPUT, text: 'Input' },
  { id: ARGUMENT_TYPE_SELECT, text: 'Select' }
])
