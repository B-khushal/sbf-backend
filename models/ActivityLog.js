const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userName: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      index: true,
    },
    url: {
      type: String,
      default: '',
      index: true,
    },
    method: {
      type: String,
      default: 'GET',
      index: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Success', 'Failed'],
      default: 'Success',
      index: true,
    },
    sessionId: {
      type: String,
      default: '',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

activityLogSchema.index({ timestamp: -1, actionType: 1, status: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
