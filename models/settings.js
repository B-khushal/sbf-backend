const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  image: { type: String, required: true },
  ctaText: { type: String, required: true },
  ctaLink: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const homeSectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String },
  type: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  content: mongoose.Schema.Types.Mixed
});

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Category name is required'],
    trim: true
  },
  slug: { 
    type: String, 
    required: [true, 'Category slug is required'],
    trim: true,
    lowercase: true
  },
  description: { 
    type: String,
    trim: true
  },
  order: { 
    type: Number, 
    default: 0,
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  parentCategory: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settings.categories',
    index: true
  },
  image: String,
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Add compound index for slug uniqueness within parent category
categorySchema.index({ slug: 1, parentCategory: 1 }, { unique: true });

// Add virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Settings',
  localField: '_id',
  foreignField: 'categories.parentCategory'
});

const navigationItemSchema = new mongoose.Schema({
  id: String,
  label: String,
  href: String,
  enabled: {
    type: Boolean,
    default: true
  },
  order: Number
});

const headerSettingsSchema = new mongoose.Schema({
  logo: String,
  showSearch: { type: Boolean, default: true },
  showCart: { type: Boolean, default: true },
  showWishlist: { type: Boolean, default: true }
});

const socialLinkSchema = new mongoose.Schema({
  platform: String,
  url: String,
  enabled: {
    type: Boolean,
    default: true
  }
});

const footerLinkSchema = new mongoose.Schema({
  label: String,
  href: String,
  enabled: {
    type: Boolean,
    default: true
  }
});

const footerSectionSchema = new mongoose.Schema({
  section: String,
  items: [footerLinkSchema]
});

const footerSettingsSchema = new mongoose.Schema({
  logo: String,
  showSocials: { type: Boolean, default: true },
  showNewsletter: { type: Boolean, default: true },
  copyrightText: String
});

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: true,
    default: 'Spring Blossoms Florist'
  },
  siteDescription: {
    type: String,
    default: 'Your premier destination for beautiful floral arrangements'
  },
  contactEmail: {
    type: String,
    required: true,
    default: 'contact@example.com'
  },
  contactPhone: {
    type: String,
    required: true,
    default: '+1234567890'
  },
  address: {
    type: String,
    required: true,
    default: '123 Flower Street'
  },
  categories: [categorySchema],
  socialLinks: {
    facebook: String,
    instagram: String,
    twitter: String
  },
  deliverySettings: {
    minimumOrder: {
      type: Number,
      default: 0
    },
    deliveryFee: {
      type: Number,
      default: 0
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 0
    }
  },
  heroSlides: [heroSlideSchema],
  homeSections: [homeSectionSchema],
  headerSettings: headerSettingsSchema,
  footerSettings: footerSettingsSchema,
  updatedAt: { type: Date, default: Date.now }
});

// Ensure indexes for better query performance
settingsSchema.index({ 'categories.slug': 1 });
settingsSchema.index({ 'categories.parentCategory': 1 });
settingsSchema.index({ updatedAt: -1 });

// Update timestamp on save
settingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Update category timestamp on save
categorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create default settings if they don't exist
settingsSchema.statics.initializeDefaultSettings = async function() {
  const settings = await this.findOne();
  if (!settings) {
    const defaultCategories = [
      {
        name: 'Birthday',
        slug: 'birthday',
        description: 'Beautiful birthday flower arrangements',
        order: 0,
        isActive: true,
        subcategories: [
          {
            name: 'Bouquets',
            slug: 'birthday-bouquets',
            description: 'Birthday flower bouquets',
            order: 0,
            isActive: true
          },
          {
            name: 'Baskets',
            slug: 'birthday-baskets',
            description: 'Birthday flower baskets',
            order: 1,
            isActive: true
          }
        ]
      },
      {
        name: 'Anniversary',
        slug: 'anniversary',
        description: 'Romantic anniversary flowers',
        order: 1,
        isActive: true,
        subcategories: [
          {
            name: 'Roses',
            slug: 'anniversary-roses',
            description: 'Anniversary rose arrangements',
            order: 0,
            isActive: true
          },
          {
            name: 'Mixed Flowers',
            slug: 'anniversary-mixed',
            description: 'Mixed flower arrangements for anniversaries',
            order: 1,
            isActive: true
          }
        ]
      },
      {
        name: 'Wedding',
        slug: 'wedding',
        description: 'Elegant wedding flowers and decorations',
        order: 2,
        isActive: true,
        subcategories: [
          {
            name: 'Bridal Bouquets',
            slug: 'wedding-bridal',
            description: 'Beautiful bridal bouquets',
            order: 0,
            isActive: true
          },
          {
            name: 'Centerpieces',
            slug: 'wedding-centerpieces',
            description: 'Wedding table centerpieces',
            order: 1,
            isActive: true
          }
        ]
      }
    ];

    // Process categories to set up parent-child relationships
    const processedCategories = defaultCategories.reduce((acc, category) => {
      const { subcategories, ...mainCategory } = category;
      const mainCat = { ...mainCategory };
      acc.push(mainCat);
      
      if (subcategories) {
        subcategories.forEach(sub => {
          acc.push({
            ...sub,
            parentCategory: mainCat._id
          });
        });
      }
      
      return acc;
    }, []);

    const defaultSettings = {
      siteName: 'Spring Blossoms Florist',
      siteDescription: 'Your premier destination for beautiful floral arrangements',
      contactEmail: 'contact@example.com',
      contactPhone: '+1234567890',
      address: '123 Flower Street',
      categories: processedCategories,
      socialLinks: {
        facebook: 'https://facebook.com/springblossoms',
        instagram: 'https://instagram.com/springblossoms',
        twitter: 'https://twitter.com/springblossoms'
      },
      deliverySettings: {
        minimumOrder: 1000,
        deliveryFee: 200,
        freeDeliveryThreshold: 5000
      },
      headerSettings: {
        logo: '/images/logo.png',
        showSearch: true,
        showCart: true,
        showWishlist: true
      },
      footerSettings: {
        logo: '/images/logo.png',
        showSocials: true,
        showNewsletter: true,
        copyrightText: '© 2024 Spring Blossoms Florist. All rights reserved.'
      }
    };

    await this.create(defaultSettings);
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings; 