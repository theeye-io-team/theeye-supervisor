
exports.TYPE_SCRIPT = 'script'
exports.TYPE_SCRAPER = 'scraper'

const ARGUMENT_TYPE_FIXED = 'fixed'
const ARGUMENT_TYPE_INPUT = 'input'
const ARGUMENT_TYPE_SELECT = 'select'
const ARGUMENT_TYPE_DATE = 'date'
const ARGUMENT_TYPE_FILE = 'file'

exports.ARGUMENT_TYPE_FIXED = ARGUMENT_TYPE_FIXED
exports.ARGUMENT_TYPE_INPUT = ARGUMENT_TYPE_INPUT
exports.ARGUMENT_TYPE_SELECT = ARGUMENT_TYPE_SELECT
exports.ARGUMENT_TYPE_DATE = ARGUMENT_TYPE_DATE
exports.ARGUMENT_TYPE_FILE = ARGUMENT_TYPE_FILE

exports.ARGUMENT_TYPES = Object.freeze([
  { id: ARGUMENT_TYPE_FIXED, text: 'Fixed' },
  { id: ARGUMENT_TYPE_INPUT, text: 'Input' },
  { id: ARGUMENT_TYPE_SELECT, text: 'Select' },
  { id: ARGUMENT_TYPE_DATE, text: 'Date' },
  { id: ARGUMENT_TYPE_FILE, text: 'File' }
])
