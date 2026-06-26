const mongoose = require('mongoose');

const deliveryProofSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAssignment',
    required: true,
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  verificationType: {
    type: String,
    enum: ['otp', 'photo', 'signature'],
    default: 'photo'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  latitude: Number,
  longitude: Number
}, {
  timestamps: true
});

const DeliveryProof = mongoose.model('DeliveryProof', deliveryProofSchema);
module.exports = DeliveryProof;
