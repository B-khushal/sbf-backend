const mongoose = require('mongoose');

// Timeline card schema for each Valentine week date
const timelineCardSchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: Date, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🌹' },
  bannerImage: { type: String, default: '' },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  offers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ValentineOffer' }],
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

// Valentine special category schema
const valentineCategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

// Gift builder item schema
const giftBuilderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  category: {
    type: String,
    enum: ['flowers', 'chocolates', 'teddy', 'greeting_card', 'photo_frame', 'perfume', 'custom_message'],
    required: true
  },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, default: 0 },
  image: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  stock: { type: Number, default: 100 },
  order: { type: Number, default: 0 }
});

// Valentine banner schema
const valentineBannerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  image: { type: String, default: '' },
  link: { type: String, default: '/valentine-special' },
  position: {
    type: String,
    enum: ['announcement', 'hero', 'carousel', 'popup'],
    default: 'hero'
  },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const valentineSettingsSchema = new mongoose.Schema({
  // Master ON/OFF switch
  enabled: { type: Boolean, default: false },

  // General campaign settings
  general: {
    campaignName: { type: String, default: "Valentine's Week Special" },
    startDate: { type: Date, default: () => new Date(new Date().getFullYear(), 1, 7) }, // Feb 7
    endDate: { type: Date, default: () => new Date(new Date().getFullYear(), 1, 16) },   // Feb 16
    countdownTargetDate: { type: Date, default: () => new Date(new Date().getFullYear(), 1, 14) } // Feb 14
  },

  // Theme customization
  theme: {
    primaryColor: { type: String, default: '#be123c' },     // Deep rose
    secondaryColor: { type: String, default: '#fda4af' },   // Soft pink
    accentColor: { type: String, default: '#d4a574' },      // Gold
    backgroundGradient: { type: String, default: 'linear-gradient(135deg, #1a0011 0%, #2d0a1f 30%, #1a0011 60%, #0d0015 100%)' },
    heroImage: { type: String, default: '' },
    heroHeadline: { type: String, default: 'Celebrate Love This Valentine Week' },
    heroSubheadline: { type: String, default: 'Exclusive bouquets, romantic gifts, surprise hampers, and special offers crafted for your loved ones.' },
    ctaButton1Text: { type: String, default: "Shop Valentine's Collection" },
    ctaButton1Link: { type: String, default: '#valentine-categories' },
    ctaButton2Text: { type: String, default: "Explore Valentine's Week Offers" },
    ctaButton2Link: { type: String, default: '#valentine-offers' },
    floatingPetals: { type: Boolean, default: true },
    heartAnimations: { type: Boolean, default: true },
    confetti: { type: Boolean, default: false }
  },

  // Valentine Week Timeline (8 days)
  timeline: {
    type: [timelineCardSchema],
    default: () => [
      { id: 'rose-day', date: new Date(new Date().getFullYear(), 1, 8), title: 'Rose Day', description: 'Express your love with beautiful roses', icon: '🌹', enabled: true, order: 0 },
      { id: 'propose-day', date: new Date(new Date().getFullYear(), 1, 9), title: 'Propose Day', description: 'Pop the question with a grand gesture', icon: '💍', enabled: true, order: 1 },
      { id: 'chocolate-day', date: new Date(new Date().getFullYear(), 1, 10), title: 'Chocolate Day', description: 'Sweeten the bond with premium chocolates', icon: '🍫', enabled: true, order: 2 },
      { id: 'teddy-day', date: new Date(new Date().getFullYear(), 1, 11), title: 'Teddy Day', description: 'Gift a cuddly companion to your loved one', icon: '🧸', enabled: true, order: 3 },
      { id: 'promise-day', date: new Date(new Date().getFullYear(), 1, 12), title: 'Promise Day', description: 'Make promises that last a lifetime', icon: '🤝', enabled: true, order: 4 },
      { id: 'hug-day', date: new Date(new Date().getFullYear(), 1, 13), title: 'Hug Day', description: 'Warm hugs and heartfelt gifts', icon: '🤗', enabled: true, order: 5 },
      { id: 'valentines-day', date: new Date(new Date().getFullYear(), 1, 14), title: "Valentine's Day", description: 'The day of love - celebrate in style', icon: '❤️', enabled: true, order: 6 },
      { id: 'celebration-day', date: new Date(new Date().getFullYear(), 1, 15), title: 'Celebration Day', description: 'Continue the celebration of love', icon: '🎉', enabled: true, order: 7 }
    ]
  },

  // Valentine special product categories
  categories: {
    type: [valentineCategorySchema],
    default: () => [
      { id: 'premium-rose-bouquets', name: 'Premium Rose Bouquets', slug: 'premium-rose-bouquets', description: 'Hand-tied luxury rose arrangements', enabled: true, order: 0 },
      { id: 'luxury-flower-boxes', name: 'Luxury Flower Boxes', slug: 'luxury-flower-boxes', description: 'Elegant boxed flower arrangements', enabled: true, order: 1 },
      { id: 'romantic-gift-hampers', name: 'Romantic Gift Hampers', slug: 'romantic-gift-hampers', description: 'Curated romantic gift collections', enabled: true, order: 2 },
      { id: 'chocolates-flowers', name: 'Chocolates & Flowers', slug: 'chocolates-flowers', description: 'Sweet combos of chocolate and blooms', enabled: true, order: 3 },
      { id: 'teddy-combos', name: 'Teddy Combos', slug: 'teddy-combos', description: 'Adorable teddy with flower combos', enabled: true, order: 4 },
      { id: 'proposal-packages', name: 'Proposal Packages', slug: 'proposal-packages', description: 'Grand proposal arrangement packages', enabled: true, order: 5 },
      { id: 'anniversary-gifts', name: 'Anniversary Gifts', slug: 'anniversary-gifts', description: 'Timeless anniversary gift sets', enabled: true, order: 6 },
      { id: 'valentine-special-combos', name: "Valentine's Special Combos", slug: 'valentine-special-combos', description: 'Exclusive Valentine combo deals', enabled: true, order: 7 },
      { id: 'same-day-surprise', name: 'Same Day Surprise Gifts', slug: 'same-day-surprise', description: 'Last-minute surprise deliveries', enabled: true, order: 8 },
      { id: 'midnight-delivery', name: 'Midnight Delivery Gifts', slug: 'midnight-delivery', description: 'Midnight surprise delivery specials', enabled: true, order: 9 }
    ]
  },

  // Special delivery settings
  delivery: {
    sameDayEnabled: { type: Boolean, default: true },
    sameDayCharge: { type: Number, default: 0 },
    sameDayCutoff: { type: String, default: '18:00' },
    midnightEnabled: { type: Boolean, default: true },
    midnightCharge: { type: Number, default: 200 },
    midnightCutoff: { type: String, default: '20:00' },
    fixedTimeEnabled: { type: Boolean, default: true },
    fixedTimeCharge: { type: Number, default: 150 },
    surpriseEnabled: { type: Boolean, default: true },
    surpriseCharge: { type: Number, default: 100 },
    anonymousEnabled: { type: Boolean, default: true },
    anonymousCharge: { type: Number, default: 50 },
    zones: [{
      name: { type: String },
      enabled: { type: Boolean, default: true },
      extraCharge: { type: Number, default: 0 }
    }]
  },

  // Gift Builder items
  giftBuilderItems: {
    type: [giftBuilderItemSchema],
    default: () => [
      { id: 'gb-red-roses', category: 'flowers', name: 'Red Roses Bouquet', price: 599, enabled: true, order: 0 },
      { id: 'gb-pink-roses', category: 'flowers', name: 'Pink Roses Bouquet', price: 499, enabled: true, order: 1 },
      { id: 'gb-mixed-flowers', category: 'flowers', name: 'Mixed Flower Bouquet', price: 699, enabled: true, order: 2 },
      { id: 'gb-ferrero', category: 'chocolates', name: 'Ferrero Rocher Box', price: 450, enabled: true, order: 3 },
      { id: 'gb-cadbury', category: 'chocolates', name: 'Cadbury Celebration', price: 350, enabled: true, order: 4 },
      { id: 'gb-handmade-choc', category: 'chocolates', name: 'Handmade Chocolates', price: 550, enabled: true, order: 5 },
      { id: 'gb-teddy-small', category: 'teddy', name: 'Small Teddy Bear', price: 299, enabled: true, order: 6 },
      { id: 'gb-teddy-large', category: 'teddy', name: 'Large Teddy Bear', price: 599, enabled: true, order: 7 },
      { id: 'gb-greeting-card', category: 'greeting_card', name: 'Premium Greeting Card', price: 99, enabled: true, order: 8 },
      { id: 'gb-photo-frame', category: 'photo_frame', name: 'Heart Photo Frame', price: 399, enabled: true, order: 9 },
      { id: 'gb-perfume', category: 'perfume', name: 'Mini Perfume Gift Set', price: 799, enabled: true, order: 10 },
      { id: 'gb-custom-message', category: 'custom_message', name: 'Custom Love Message Card', price: 49, enabled: true, order: 11 }
    ]
  },

  // SEO settings
  seo: {
    metaTitle: { type: String, default: "Valentine's Day Flowers & Gifts | Premium Romantic Delivery" },
    metaDescription: { type: String, default: "Order premium Valentine's flowers, bouquets, chocolates, teddy bears, and romantic gifts with same-day delivery." },
    keywords: { type: [String], default: ['valentine flowers', 'valentine gifts', 'romantic bouquets', 'valentine delivery', 'rose day gifts'] },
    ogImage: { type: String, default: '' },
    canonicalUrl: { type: String, default: '/valentine-special' }
  },

  // Marketing feature toggles
  marketing: {
    exitIntentPopup: { type: Boolean, default: true },
    exitIntentTitle: { type: String, default: "Don't Miss Valentine's Specials!" },
    exitIntentSubtitle: { type: String, default: 'Use code LOVE20 for 20% off!' },
    exitIntentCode: { type: String, default: 'LOVE20' },
    limitedStockIndicators: { type: Boolean, default: true },
    trendingProducts: { type: Boolean, default: true },
    bestSellerBadges: { type: Boolean, default: true },
    recentPurchaseNotifications: { type: Boolean, default: true },
    socialProofWidgets: { type: Boolean, default: true }
  },

  // Homepage integration banners
  banners: {
    type: [valentineBannerSchema],
    default: () => [
      {
        id: 'vb-announcement',
        title: "💕 Valentine's Week Sale is LIVE! Up to 40% OFF",
        subtitle: 'Shop Now',
        link: '/valentine-special',
        position: 'announcement',
        enabled: true,
        order: 0
      },
      {
        id: 'vb-hero',
        title: "Celebrate Love This Valentine's",
        subtitle: 'Premium bouquets, romantic gifts & same-day delivery',
        link: '/valentine-special',
        position: 'hero',
        enabled: true,
        order: 0
      }
    ]
  },

  // Mobile Navigation Settings
  mobileNavigation: {
    showSbfButton: { type: Boolean, default: true },
    sbfLabel: { type: String, default: 'SBF' },
    enableValentineButton: { type: Boolean, default: true },
    valentineIcon: { type: String, enum: ['heart', 'rose', 'gift'], default: 'heart' },
    valentineButtonColor: { type: String, default: '#FF2E78' },
    glowIntensity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    navbarBackgroundStyle: { type: String, enum: ['glassmorphism', 'solid'], default: 'glassmorphism' },
    enableFloatingAnimation: { type: Boolean, default: true },
    enableHeartParticles: { type: Boolean, default: true },
    enableSeasonalTheme: { type: Boolean, default: true }
  },

  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Static method to get or create singleton
valentineSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
    console.log('🌹 Valentine Settings: Initialized with defaults');
  }
  return settings;
};

// Pre-save hook to update timestamp
valentineSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const ValentineSettings = mongoose.model('ValentineSettings', valentineSettingsSchema);

module.exports = ValentineSettings;
