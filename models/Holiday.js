const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Holiday name is required'],
    trim: true,
    maxlength: [100, 'Holiday name cannot exceed 100 characters']
  },
  date: {
    type: Date,
    required: [true, 'Holiday date is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason for non-delivery is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['fixed', 'dynamic', 'store'],
    default: 'store',
    required: true
  },
  category: {
    type: String,
    enum: ['national', 'religious', 'store', 'maintenance', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  recurring: {
    type: Boolean,
    default: false
  },
  recurringYears: [{
    type: Number
  }],
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
  }
});

// Index for efficient querying
holidaySchema.index({ year: 1, month: 1, day: 1 });
holidaySchema.index({ isActive: 1, year: 1 });
holidaySchema.index({ type: 1, category: 1 });

// Pre-save middleware to update year, month, day fields
holidaySchema.pre('save', function(next) {
  if (this.date) {
    this.year = this.date.getFullYear();
    this.month = this.date.getMonth() + 1; // getMonth() returns 0-11
    this.day = this.date.getDate();
  }
  this.updatedAt = new Date();
  next();
});

// Static method to get holidays for a specific year
holidaySchema.statics.getHolidaysForYear = async function(year) {
  return await this.find({
    year: year,
    isActive: true
  }).sort({ month: 1, day: 1 });
};

// Static method to get holidays for a date range
holidaySchema.statics.getHolidaysForDateRange = async function(startDate, endDate) {
  return await this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    },
    isActive: true
  }).sort({ date: 1 });
};

// Static method to check if a specific date is a holiday
holidaySchema.statics.isHoliday = async function(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return await this.findOne({
    year: year,
    month: month,
    day: day,
    isActive: true
  });
};

// Static method to get all active holidays
holidaySchema.statics.getActiveHolidays = async function() {
  return await this.find({ isActive: true }).sort({ year: 1, month: 1, day: 1 });
};

// Instance method to check if holiday is recurring
holidaySchema.methods.isRecurring = function() {
  return this.recurring && this.recurringYears.length > 0;
};

// Instance method to get next occurrence
holidaySchema.methods.getNextOccurrence = function() {
  if (!this.recurring) return null;
  
  const currentYear = new Date().getFullYear();
  const nextYear = this.recurringYears.find(year => year > currentYear);
  
  if (nextYear) {
    return new Date(nextYear, this.month - 1, this.day);
  }
  
  return null;
};

module.exports = mongoose.model('Holiday', holidaySchema); 