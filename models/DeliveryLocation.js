const mongoose = require('mongoose');

const deliveryLocationSchema = new mongoose.Schema({
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    required: true,
    index: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAssignment',
    index: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

deliveryLocationSchema.index({ coordinates: '2dsphere' });

const DeliveryLocation = mongoose.model('DeliveryLocation', deliveryLocationSchema);
module.exports = DeliveryLocation;
