const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  subscriptionDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    default: 'website'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Add index for email field
newsletterSchema.index({ email: 1 });

// Pre-save middleware to update lastUpdated
newsletterSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

module.exports = Newsletter; 