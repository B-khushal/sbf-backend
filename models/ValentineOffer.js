const mongoose = require('mongoose');

const valentineOfferSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['bogo', 'flat_discount', 'percentage_discount', 'free_item', 'free_delivery', 'combo_discount'],
    required: true,
    default: 'flat_discount'
  },
  discountValue: {
    type: Number,
    default: 0
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  freeItemName: {
    type: String,
    default: ''
  },
  // Products this offer applies to
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // Optional coupon code
  code: {
    type: String,
    default: '',
    trim: true,
    uppercase: true
  },
  // Visual customization
  image: {
    type: String,
    default: ''
  },
  badgeText: {
    type: String,
    default: ''
  },
  badgeColor: {
    type: String,
    default: '#be123c'
  },
  // Scheduling
  startDate: {
    type: Date,
    default: () => new Date(new Date().getFullYear(), 1, 7) // Feb 7
  },
  endDate: {
    type: Date,
    default: () => new Date(new Date().getFullYear(), 1, 16) // Feb 16
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Tracking
  usageCount: {
    type: Number,
    default: 0
  },
  maxUsage: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  // Display order
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Check if offer is currently valid
valentineOfferSchema.methods.isValid = function () {
  const now = new Date();
  return this.isActive &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.maxUsage === 0 || this.usageCount < this.maxUsage);
};

// Static: get all active offers
valentineOfferSchema.statics.getActiveOffers = async function () {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ order: 1 });
};

const ValentineOffer = mongoose.model('ValentineOffer', valentineOfferSchema);

module.exports = ValentineOffer;
