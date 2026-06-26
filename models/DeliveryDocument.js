const mongoose = require('mongoose');

const deliveryDocumentSchema = new mongoose.Schema({
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    required: true,
    index: true
  },
  aadhaarNumber: {
    type: String
  },
  aadhaarFileUrl: {
    type: String
  },
  panNumber: {
    type: String
  },
  panFileUrl: {
    type: String
  },
  licenseNumber: {
    type: String
  },
  licenseFileUrl: {
    type: String
  },
  vehicleRcNumber: {
    type: String
  },
  vehicleRcFileUrl: {
    type: String
  },
  insuranceNumber: {
    type: String
  },
  insuranceFileUrl: {
    type: String
  },
  bankAccountHolder: {
    type: String
  },
  bankAccountNumber: {
    type: String
  },
  bankIfscCode: {
    type: String
  },
  bankDetailsFileUrl: {
    type: String
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

const DeliveryDocument = mongoose.model('DeliveryDocument', deliveryDocumentSchema);
module.exports = DeliveryDocument;
