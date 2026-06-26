const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    default: 'Hyderabad'
  },
  boundary: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
      required: true
    },
    coordinates: {
      type: [[[Number]]], // Array of arrays of arrays of numbers: [[ [lng, lat], [lng, lat], ... ]]
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  baseDeliveryCharge: {
    type: Number,
    default: 150
  }
}, {
  timestamps: true
});

// index boundary for geospatial queries
deliveryZoneSchema.index({ boundary: '2dsphere' });

const DeliveryZone = mongoose.model('DeliveryZone', deliveryZoneSchema);
module.exports = DeliveryZone;
