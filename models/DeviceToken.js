const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceType: {
    type: String,
    enum: ['android', 'ios'],
    required: true
  },
  deviceInfo: {
    model: String,
    platform: String,
    osVersion: String,
    appVersion: String
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for querying active tokens by user
deviceTokenSchema.index({ userId: 1, isActive: 1 });

// Method to mark token as inactive
deviceTokenSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Method to update last used timestamp
deviceTokenSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

// Static method to clean up old inactive tokens (older than 90 days)
deviceTokenSchema.statics.cleanupOldTokens = async function() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const result = await this.deleteMany({
    isActive: false,
    updatedAt: { $lt: ninetyDaysAgo }
  });
  
  console.log(`🗑️  Cleaned up ${result.deletedCount} old inactive device tokens`);
  return result;
};

// Static method to find or create device token
deviceTokenSchema.statics.findOrCreate = async function(userId, token, deviceType, deviceInfo = {}) {
  try {
    // Check if token already exists
    let deviceToken = await this.findOne({ token });
    
    if (deviceToken) {
      // Update existing token
      deviceToken.userId = userId;
      deviceToken.deviceType = deviceType;
      deviceToken.deviceInfo = { ...deviceToken.deviceInfo, ...deviceInfo };
      deviceToken.isActive = true;
      deviceToken.lastUsed = new Date();
      await deviceToken.save();
      console.log('✅ Updated existing device token');
      return { deviceToken, created: false };
    } else {
      // Create new token
      deviceToken = await this.create({
        userId,
        token,
        deviceType,
        deviceInfo,
        isActive: true,
        lastUsed: new Date()
      });
      console.log('✅ Created new device token');
      return { deviceToken, created: true };
    }
  } catch (error) {
    console.error('❌ Error in findOrCreate:', error.message);
    throw error;
  }
};

// Static method to get active tokens for user
deviceTokenSchema.statics.getActiveTokensForUser = async function(userId) {
  return await this.find({ userId, isActive: true }).sort({ lastUsed: -1 });
};

// Static method to get active tokens for multiple users
deviceTokenSchema.statics.getActiveTokensForUsers = async function(userIds) {
  return await this.find({ 
    userId: { $in: userIds }, 
    isActive: true 
  }).sort({ lastUsed: -1 });
};

// Static method to deactivate token by value
deviceTokenSchema.statics.deactivateToken = async function(token) {
  const result = await this.updateOne(
    { token },
    { $set: { isActive: false } }
  );
  return result;
};

// Pre-save hook to update lastUsed
deviceTokenSchema.pre('save', function(next) {
  if (this.isModified('isActive') && this.isActive) {
    this.lastUsed = new Date();
  }
  next();
});

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
