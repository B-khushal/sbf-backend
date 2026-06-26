const mongoose = require('mongoose');

const deliveryAssignmentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    index: true
  },
  status: {
    type: String,
    enum: [
      'pending_assignment',
      'assigned',
      'accepted',
      'reached_store',
      'picked_up',
      'out_for_delivery',
      'reached_customer',
      'delivered',
      'failed_delivery',
      'cancelled'
    ],
    default: 'pending_assignment',
    index: true
  },
  failReason: {
    type: String,
    enum: ['customer_unavailable', 'rescheduled', 'returned_to_store', 'other']
  },
  distance: {
    type: Number, // in km
    default: 0
  },
  eta: {
    type: Number, // in minutes
    default: 0
  },
  pickupTime: {
    type: Date
  },
  deliveryTime: {
    type: Date
  },
  routeHistory: [{
    latitude: Number,
    longitude: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  customerOtp: {
    type: String,
    required: true
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  earnings: {
    type: Number,
    default: 0
  },
  reassignmentCount: {
    type: Number,
    default: 0
  },
  history: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: String,
      default: 'system'
    },
    remarks: String
  }]
}, {
  timestamps: true
});

deliveryAssignmentSchema.index({ createdAt: -1 });

const DeliveryAssignment = mongoose.model('DeliveryAssignment', deliveryAssignmentSchema);
module.exports = DeliveryAssignment;
