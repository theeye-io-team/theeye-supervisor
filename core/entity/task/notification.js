const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const NotificationSchema = new BaseSchema({
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'NotificationTaskTemplate' },
  type: { type: String, default: 'notification' },
  subject: { type: String, required: true },
  body: { type: String },
  notificationTypes: {
    type: Object,
    default: () => {
      return {
        push: true,
        email: false,
        socket: false,
        desktop: false
      }
    }
  },
  recipients: [{ type: String }]
})

module.exports = NotificationSchema
