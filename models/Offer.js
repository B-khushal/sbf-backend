const mongoose = require('mongoose');

const offerVariantSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: false
  },
  mobileImageUrl: {
    type: String,
    required: false
  },
  discountPercent: {
    type: Number,
    default: 0
  },
  code: {
    type: String,
    trim: true
  },
  buttonText: {
    type: String,
    default: 'Shop Now'
  },
  buttonLink: {
    type: String,
    required: true
  },
  background: {
    type: String,
    default: '#ffffff'
  },
  textColor: {
    type: String,
    default: '#000000'
  },
  badgeText: {
    type: String,
    default: 'Limited Time Offer'
  },
  theme: {
    type: String,
    enum: ['festive', 'sale', 'holiday', 'general', 'rakhi', 'valentines', 'mothersday', 'fathersday', 'diwali', 'christmas', 'newyear'],
    default: 'general'
  },
  // Variant specific metrics
  impressions: {
    type: Number,
    default: 0
  },
  closes: {
    type: Number,
    default: 0
  },
  ctaClicks: {
    type: Number,
    default: 0
  },
  couponCopies: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  }
});

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  },
  mobileImageUrl: {
    type: String,
    required: false
  },
  discountPercent: {
    type: Number,
    default: 0
  },
  code: {
    type: String,
    trim: true
  },
  background: {
    type: String,
    default: '#ffffff'
  },
  textColor: {
    type: String,
    default: '#000000'
  },
  buttonText: {
    type: String,
    default: 'Shop Now'
  },
  buttonLink: {
    type: String,
    required: true
  },
  secondaryCtaText: {
    type: String,
    default: 'Remind Me Later'
  },
  secondaryCtaLink: {
    type: String,
    required: false
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  showOnlyOnce: {
    type: Boolean,
    default: false
  },
  showCountdown: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    enum: ['festive', 'sale', 'holiday', 'general', 'rakhi', 'valentines', 'mothersday', 'fathersday', 'diwali', 'christmas', 'newyear'],
    default: 'general'
  },
  badgeText: {
    type: String,
    default: 'Limited Time Offer'
  },
  
  // Smart trigger configuration
  triggerType: {
    type: String,
    enum: ['timeDelay', 'scroll', 'exitIntent', 'immediately', 'combined'],
    default: 'combined'
  },
  triggerDelay: {
    type: Number,
    default: 8
  },
  triggerScrollPercent: {
    type: Number,
    default: 30
  },
  frequencyCap: {
    type: String,
    enum: ['always', 'oncePerSession', 'oncePerDay', 'oncePerWeek', 'oncePerMonth', 'onceEver'],
    default: 'oncePerSession'
  },
  deviceTargeting: {
    type: String,
    enum: ['desktop', 'mobile', 'both'],
    default: 'both'
  },

  // A/B Testing
  isABTesting: {
    type: Boolean,
    default: false
  },
  variants: {
    type: [offerVariantSchema],
    default: []
  },

  // Base metrics
  impressions: {
    type: Number,
    default: 0
  },
  closes: {
    type: Number,
    default: 0
  },
  ctaClicks: {
    type: Number,
    default: 0
  },
  couponCopies: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
offerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Offer', offerSchema); 