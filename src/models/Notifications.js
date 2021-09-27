const mongoose = require('mongoose');

const { Schema } = mongoose;

const { NOTIFICATION_TYPE, LIST_ROLE } = require('../constants');

const notificationSchema = new Schema({
  message: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: [LIST_ROLE.EMPLOYEER, LIST_ROLE.MANAGER],
    default: LIST_ROLE.EMPLOYEER,
  },
  isRead: {
    type: Boolean,
    required: true,
    default: false,
  },
  type: {
    type: String,
    required: true,
    enum: [
      NOTIFICATION_TYPE.NEW_ORDER,
    ],
  },
  data: {
    type: Object,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Notifications = mongoose.model('notifications', notificationSchema);

module.exports = Notifications;
