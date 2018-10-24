//const util = require('util')
const Schema = require('mongoose').Schema
const BaseSchema = require('../base-schema')
const FetchBy = require('../../lib/fetch-by')
const randomSecret = require('../../lib/random-secret')
const Constants = require('../../constants/monitors')
const ObjectId = Schema.Types.ObjectId

class IndicatorSchema extends BaseSchema {
  constructor (specificProps) {

    specificProps || (specificProps={})

    const specs = { collection: 'indicators' }
    const baseProps = {
      customer_name: { type: String, required: true },
      user_id: { type: ObjectId }, // owner/creator
      user: { type: ObjectId, ref: 'User' },
      description: { type: String },
      title: { type: String, required: true, index: true },
      acl: [{ type: String }],
      severity: { type: String, default: Constants.MONITOR_SEVERITY_HIGH },
      alerts: { type: Boolean, default: true },
      state: { type: String, default: 'normal' },
      sticky: { type: Boolean, default: false },
      read_only: { type: Boolean, default: false },
      secret: { type: String, default: randomSecret }, // one way hash
    }

    // Schema constructor
    super(Object.assign({}, baseProps, specificProps), specs)

    //BaseSchema.call(
    //  this,
    //  Object.assign({}, baseProps, specificProps),
    //  specs
    //)

    this.statics.fetchBy = function (filter, next) {
      FetchBy.call(this, filter, next)
    }

    // Duplicate the ID field.
    this.virtual('id').get(function(){
      return this._id.toHexString()
    })

    const def = {
      getters: true,
      virtuals: true,
      transform (doc, ret, options) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v

        delete ret.user
        delete ret.customer
      }
    }

    this.set('toJSON', def)
    this.set('toObject', def)

    this.index({ title: 1, customer_id: 1 }, { unique: true })

    this.pre('save', function(next) {
      this.last_update = new Date()
      // do stuff
      next()
    })
  }
}

//util.inherits(IndicatorSchema, Schema)

module.exports = IndicatorSchema
