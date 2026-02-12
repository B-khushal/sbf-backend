const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['order', 'system', 'admin', 'info'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Admin notifications don't have specific user
  },
  hiddenUntil: {
    type: Date,
    default: null // When null, notification is visible. When set, hidden until this date.
  },
  hiddenFromSession: {
    type: String,
    default: null // Session ID that hid this notification
  },
  metadata: {
    type: Object,
    default: {} // Additional data for notifications
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema); 
