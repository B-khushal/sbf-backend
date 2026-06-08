const mongoose = require('mongoose');

const addonProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  galleryImages: {
    type: [String],
    default: []
  },
  images: {
    type: [String],
    default: []
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  discountedPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  SKU: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  tags: {
    type: [String],
    default: []
  },
  badge: {
    type: String,
    enum: ['', 'Bestseller', 'Most Gifted', 'New', 'Limited'],
    default: ''
  },
  linkedCategories: {
    type: [String],
    default: []
  },
  linkedOccasions: {
    type: [String],
    default: []
  },
  linkedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  active: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Sync name -> title and [image, ...galleryImages] -> images on save for strict population/selection compatibility
addonProductSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.title) {
    this.title = this.name;
  }
  
  // Combine image and galleryImages into the images array
  const combinedImages = [this.image, ...this.galleryImages].filter(Boolean);
  this.images = combinedImages;
  
  next();
});

const AddonProduct = mongoose.model('AddonProduct', addonProductSchema);
module.exports = AddonProduct;
