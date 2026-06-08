const mongoose = require('mongoose');

const addonProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Addon product name is required'],
    trim: true,
    maxlength: [150, 'Name cannot exceed 150 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    default: '',
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'Chocolates',
        'Greeting Cards',
        'Teddy Bears',
        'Candles',
        'Cakes',
        'Perfumes',
        'Balloons',
        'Gift Hampers',
        'Dry Fruits',
        'Plants',
        'Mugs',
        'Photo Frames',
        'Other'
      ],
      message: '{VALUE} is not a valid addon category'
    }
  },
  image: {
    type: String,
    required: [true, 'Product image is required']
  },
  galleryImages: {
    type: [String],
    default: []
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    default: null,
    validate: {
      validator: function(value) {
        if (value === null || value === undefined) return true;
        return value < this.price;
      },
      message: 'Discounted price must be less than the original price'
    }
  },
  stock: {
    type: Number,
    default: 100,
    min: [0, 'Stock cannot be negative']
  },
  sku: {
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
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
addonProductSchema.index({ status: 1, sortOrder: 1 });
addonProductSchema.index({ category: 1 });
addonProductSchema.index({ linkedCategories: 1 });
addonProductSchema.index({ slug: 1 });
addonProductSchema.index({ badge: 1 });

// Pre-save hook to auto-generate slug
addonProductSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }
  next();
});

// Virtual for effective price (discounted or original)
addonProductSchema.virtual('effectivePrice').get(function() {
  return this.discountedPrice != null ? this.discountedPrice : this.price;
});

// Virtual for discount percentage
addonProductSchema.virtual('discountPercentage').get(function() {
  if (this.discountedPrice != null && this.price > 0) {
    return Math.round(((this.price - this.discountedPrice) / this.price) * 100);
  }
  return 0;
});

// Virtual for in-stock check
addonProductSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Ensure virtual fields are serialized
addonProductSchema.set('toJSON', { virtuals: true });
addonProductSchema.set('toObject', { virtuals: true });

const AddonProduct = mongoose.model('AddonProduct', addonProductSchema);

module.exports = AddonProduct;
