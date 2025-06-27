const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Promo code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [3, 'Promo code must be at least 3 characters'],
    maxlength: [20, 'Promo code cannot exceed 20 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  image: {
    type: String,
    trim: true,
    default: null // Optional promo code image URL
  },
  background: {
    type: String,
    default: '#ffffff'
  },
  discountType: {
    type: String,
    required: [true, 'Discount type is required'],
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  minimumOrderAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order amount cannot be negative']
  },
  maximumDiscountAmount: {
    type: Number,
    default: null, // null means no maximum limit
    min: [0, 'Maximum discount amount cannot be negative']
  },
  usageLimit: {
    type: Number,
    default: null, // null means unlimited usage
    min: [1, 'Usage limit must be at least 1']
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Used count cannot be negative']
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required'],
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [{
    type: String,
    trim: true
  }], // Empty array means applicable to all categories
  excludedCategories: [{
    type: String,
    trim: true
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }], // Empty array means applicable to all products
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  firstTimeUserOnly: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    campaignName: String,
    notes: String,
    tags: [String]
  }
});

// Index for efficient querying
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
promoCodeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for checking if promo code is currently valid
promoCodeSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Method to check if promo code is applicable to specific order
promoCodeSchema.methods.isApplicableToOrder = function(orderData) {
  const { totalAmount, items = [], userId } = orderData;
  
  // Check if promo code is currently valid
  if (!this.isCurrentlyValid) {
    return { valid: false, reason: 'Promo code is not currently valid' };
  }
  
  // Check minimum order amount
  if (totalAmount < this.minimumOrderAmount) {
    return { 
      valid: false, 
      reason: `Minimum order amount of ₹${this.minimumOrderAmount} required` 
    };
  }
  
  // Check usage limit
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
    return { valid: false, reason: 'Promo code usage limit exceeded' };
  }
  
  // Check category restrictions
  if (this.applicableCategories.length > 0) {
    const hasApplicableCategory = items.some(item => 
      this.applicableCategories.includes(item.category)
    );
    if (!hasApplicableCategory) {
      return { 
        valid: false, 
        reason: `Promo code only applicable to: ${this.applicableCategories.join(', ')}` 
      };
    }
  }
  
  // Check excluded categories
  if (this.excludedCategories.length > 0) {
    const hasExcludedCategory = items.some(item => 
      this.excludedCategories.includes(item.category)
    );
    if (hasExcludedCategory) {
      return { 
        valid: false, 
        reason: `Promo code not applicable to: ${this.excludedCategories.join(', ')}` 
      };
    }
  }
  
  return { valid: true, reason: 'Promo code is applicable' };
};

// Method to calculate discount amount
promoCodeSchema.methods.calculateDiscount = function(orderAmount) {
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (orderAmount * this.discountValue) / 100;
  } else if (this.discountType === 'fixed') {
    discountAmount = this.discountValue;
  }
  
  // Apply maximum discount limit if set
  if (this.maximumDiscountAmount !== null && discountAmount > this.maximumDiscountAmount) {
    discountAmount = this.maximumDiscountAmount;
  }
  
  // Ensure discount doesn't exceed order amount
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }
  
  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

// Method to increment usage count
promoCodeSchema.methods.incrementUsage = async function() {
  this.usedCount += 1;
  await this.save();
};

// Static method to find valid promo codes
promoCodeSchema.statics.findValidCodes = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  });
};

// Ensure virtual fields are serialized
promoCodeSchema.set('toJSON', { virtuals: true });
promoCodeSchema.set('toObject', { virtuals: true });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode; 