const mongoose = require('mongoose');

const occasionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    icon: {
      type: String,
      default: 'Gift',
    },
    banner: {
      type: String,
      default: '',
    },
    thumbnail: {
      type: String,
      default: '',
    },
    accentColor: {
      type: String,
      default: '#D4AF37', // Default Luxury Gold
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    visibleOnHomepage: {
      type: Boolean,
      default: true,
    },
    seoTitle: {
      type: String,
      default: '',
    },
    seoDescription: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to find products belonging to this occasion
occasionSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'occasionIds',
});

// Static seeder logic
occasionSchema.statics.seedDefaultOccasions = async function () {
  try {
    const count = await this.countDocuments();
    if (count > 0) return;

    console.log('🌱 Seeding default occasions...');

    const defaults = [
      { name: 'Birthday', slug: 'birthday', icon: 'Cake', accentColor: '#D4AF37', displayOrder: 0, featured: true, visibleOnHomepage: true },
      { name: 'Anniversary', slug: 'anniversary', icon: 'Gift', accentColor: '#db2777', displayOrder: 1, featured: true, visibleOnHomepage: true },
      { name: 'Love & Romance', slug: 'love-romance', icon: 'Heart', accentColor: '#e11d48', displayOrder: 2, featured: true, visibleOnHomepage: true },
      { name: 'Wedding', slug: 'wedding', icon: 'Sparkles', accentColor: '#fbbf24', displayOrder: 3, featured: false, visibleOnHomepage: true },
      { name: 'Congratulations', slug: 'congratulations', icon: 'PartyPopper', accentColor: '#10b981', displayOrder: 4, featured: false, visibleOnHomepage: true },
      { name: 'Thank You', slug: 'thank-you', icon: 'HeartHandshake', accentColor: '#6366f1', displayOrder: 5, featured: false, visibleOnHomepage: true },
      { name: 'Get Well Soon', slug: 'get-well-soon', icon: 'Activity', accentColor: '#3b82f6', displayOrder: 6, featured: false, visibleOnHomepage: true },
      { name: 'Baby Shower', slug: 'baby-shower', icon: 'Baby', accentColor: '#f43f5e', displayOrder: 7, featured: false, visibleOnHomepage: true },
      { name: 'Housewarming', slug: 'housewarming', icon: 'Home', accentColor: '#0f766e', displayOrder: 8, featured: false, visibleOnHomepage: true },
      { name: 'Sympathy', slug: 'sympathy', icon: 'Heart', accentColor: '#6b7280', displayOrder: 9, featured: false, visibleOnHomepage: true },
      { name: "Women's Day", slug: 'womens-day', icon: 'Smile', accentColor: '#ec4899', displayOrder: 10, featured: false, visibleOnHomepage: false },
      { name: "Father's Day", slug: 'fathers-day', icon: 'Award', accentColor: '#1d4ed8', displayOrder: 11, featured: false, visibleOnHomepage: false },
      { name: "Mother's Day", slug: 'mothers-day', icon: 'Award', accentColor: '#be185d', displayOrder: 12, featured: false, visibleOnHomepage: false },
      { name: 'Friendship Day', slug: 'friendship-day', icon: 'Smile', accentColor: '#eab308', displayOrder: 13, featured: false, visibleOnHomepage: false },
      { name: "Teacher's Day", slug: 'teachers-day', icon: 'Award', accentColor: '#c2410c', displayOrder: 14, featured: false, visibleOnHomepage: false },
      { name: "Valentine's Day", slug: 'valentines-day', icon: 'Heart', accentColor: '#dc2626', displayOrder: 15, featured: true, visibleOnHomepage: false },
      { name: 'Diwali', slug: 'diwali', icon: 'Flame', accentColor: '#f97316', displayOrder: 16, featured: true, visibleOnHomepage: false },
      { name: 'Christmas', slug: 'christmas', icon: 'TreePine', accentColor: '#15803d', displayOrder: 17, featured: true, visibleOnHomepage: false },
      { name: 'New Year', slug: 'new-year', icon: 'PartyPopper', accentColor: '#a21caf', displayOrder: 18, featured: true, visibleOnHomepage: false }
    ];

    await this.insertMany(defaults);
    console.log('✅ Default occasions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding default occasions:', error);
  }
};

const Occasion = mongoose.model('Occasion', occasionSchema);
module.exports = Occasion;
