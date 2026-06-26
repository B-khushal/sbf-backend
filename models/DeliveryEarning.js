const mongoose = require('mongoose');

const deliveryEarningSchema = new mongoose.Schema({
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    required: true,
    index: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAssignment',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  basePay: {
    type: Number,
    default: 0
  },
  deliveryChargeShare: {
    type: Number,
    default: 0
  },
  tips: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

const DeliveryEarning = mongoose.model('DeliveryEarning', deliveryEarningSchema);
module.exports = DeliveryEarning;
