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
  recipients: [{ type: String }],
  task_arguments: {
    type: Array,
    default: function () {
      return taskArguments()
    }
  }
})

module.exports = NotificationSchema

const taskArguments = () => {
  return [
    {
      id: 1,
      order: 0,
      type: 'input',
      label: 'subject',
      help: '',
      readonly: false,
      required: false,
      masked: false,
      options: []
    },
    {
      id: 2,
      order: 1,
      type: 'input',
      label: 'body',
      help: '',
      readonly: false,
      required: false,
      masked: false,
      options: []
    },
    {
      id: 3,
      order: 2,
      type: 'input',
      label: 'recipients',
      help: '',
      readonly: false,
      required: false,
      masked: false,
      options: []
    }
  ]
}
