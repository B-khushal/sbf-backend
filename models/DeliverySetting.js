const mongoose = require('mongoose');

const deliverySettingSchema = new mongoose.Schema({
  autoAssign: {
    type: Boolean,
    default: true
  },
  assignmentRadius: {
    type: Number, // in km
    default: 10
  },
  maxOrdersPerPartner: {
    type: Number,
    default: 3
  },
  reassignmentTimeout: {
    type: Number, // in seconds
    default: 60
  },
  baseDeliveryEarning: {
    type: Number, // flat pay to driver per order
    default: 80
  },
  earningPerKm: {
    type: Number, // extra pay per km
    default: 15
  },
  peakHourMultiplier: {
    type: Number,
    default: 1.0
  }
}, {
  timestamps: true
});

// Seed static initial setting helper
deliverySettingSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      autoAssign: true,
      assignmentRadius: 10,
      maxOrdersPerPartner: 3,
      reassignmentTimeout: 60,
      baseDeliveryEarning: 80,
      earningPerKm: 15,
      peakHourMultiplier: 1.0
    });
  }
  return settings;
};

const DeliverySetting = mongoose.model('DeliverySetting', deliverySettingSchema);
module.exports = DeliverySetting;
