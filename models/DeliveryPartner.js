const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const deliveryPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  vehicleType: {
    type: String,
    enum: ['bicycle', 'bike', 'scooter', 'car'],
    default: 'bike'
  },
  profilePhoto: {
    type: String,
    default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
    index: true
  },
  availability: {
    type: String,
    enum: ['available', 'busy'],
    default: 'available',
    index: true
  },
  currentLatitude: {
    type: Number,
    default: 17.3850 // Default store coordinates (Hyderabad center)
  },
  currentLongitude: {
    type: Number,
    default: 78.4867
  },
  activeOrders: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5.0
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  todayDeliveries: {
    type: Number,
    default: 0
  },
  todayEarnings: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  acceptanceRate: {
    type: Number,
    default: 100
  },
  lastActiveTime: {
    type: Date,
    default: Date.now
  },
  city: {
    type: String,
    default: 'Hyderabad'
  },
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryZone'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['created', 'documents_uploaded', 'under_verification', 'approved', 'active'],
    default: 'created',
    index: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for location-based sorting
deliveryPartnerSchema.index({ currentLatitude: 1, currentLongitude: 1 });
deliveryPartnerSchema.index({ status: 1, availability: 1 });

// Hash password before saving
deliveryPartnerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  if (this.password && this.password.length < 50) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  next();
});

// Compare password
deliveryPartnerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const DeliveryPartner = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
module.exports = DeliveryPartner;
