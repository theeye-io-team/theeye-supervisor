
exports.TYPE_SCRIPT = 'script'
exports.TYPE_SCRAPER = 'scraper'
exports.TYPE_APPROVAL = 'approval'
exports.TYPE_DUMMY = 'dummy'
exports.TYPE_NOTIFICATION = 'notification'

const ARGUMENT_TYPE_FIXED = 'fixed'
const ARGUMENT_TYPE_INPUT = 'input'
const ARGUMENT_TYPE_SELECT = 'select'
const ARGUMENT_TYPE_DATE = 'date'
const ARGUMENT_TYPE_FILE = 'file'
const ARGUMENT_TYPE_REMOTE_OPTIONS = 'remote-options'

exports.ARGUMENT_TYPE_FIXED = ARGUMENT_TYPE_FIXED
exports.ARGUMENT_TYPE_INPUT = ARGUMENT_TYPE_INPUT
exports.ARGUMENT_TYPE_SELECT = ARGUMENT_TYPE_SELECT
exports.ARGUMENT_TYPE_DATE = ARGUMENT_TYPE_DATE
exports.ARGUMENT_TYPE_FILE = ARGUMENT_TYPE_FILE
exports.ARGUMENT_TYPE_REMOTE_OPTIONS = ARGUMENT_TYPE_REMOTE_OPTIONS

exports.APPROVALS_TARGET_FIXED = 'fixed'
exports.APPROVALS_TARGET_ASSIGNEES = 'assignees'
exports.APPROVALS_TARGET_DYNAMIC = 'dynamic'
exports.APPROVALS_TARGET_INITIATOR = 'initiator'

exports.ARGUMENT_TYPES = Object.freeze([
  { id: ARGUMENT_TYPE_FIXED, text: 'Fixed' },
  { id: ARGUMENT_TYPE_INPUT, text: 'Input' },
  { id: ARGUMENT_TYPE_SELECT, text: 'Select' },
  { id: ARGUMENT_TYPE_DATE, text: 'Date' },
  { id: ARGUMENT_TYPE_FILE, text: 'File' },
  { id: ARGUMENT_TYPE_REMOTE_OPTIONS, text: 'Remote Options' }
])
