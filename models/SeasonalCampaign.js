const mongoose = require('mongoose');

const seasonalCategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const seasonalBannerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  image: { type: String, default: '' },
  link: { type: String, default: '' },
  position: {
    type: String,
    enum: ['announcement', 'hero', 'carousel', 'popup', 'offer', 'countdown'],
    default: 'hero'
  },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const seasonalOfferSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  code: { type: String, default: '' },
  type: {
    type: String,
    enum: ['discount', 'free-delivery', 'bogo', 'gift', 'bundle'],
    default: 'discount'
  },
  value: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const seasonalCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  
  general: {
    campaignName: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    countdownTargetDate: { type: Date, default: null },
    exploreButtonText: { type: String, default: 'Explore Collection' },
    offersButtonText: { type: String, default: 'View Offers' },
    countdownLabel: { type: String, default: 'Order Before Time Runs Out' },
    offersLabel: { type: String, default: 'Exclusive Deals' },
    offersTitle: { type: String, default: 'Special Offers For You' },
    homepageSectionBadge: { type: String, default: 'Seasonal Celebrations' },
    homepageSectionTitle: { type: String, default: 'Our Festive Specials' },
    homepageSectionSubtitle: { type: String, default: 'Make every occasion unforgettable with our specially curated seasonal flower collections.' },
    cardTagText: { type: String, default: 'Limited Campaign' },
    cardTitleText: { type: String, default: '' },
    cardDescriptionText: { type: String, default: '' },
    cardButtonText: { type: String, default: 'Shop Now' },
    cardImage: { type: String, default: '' }
  },

  theme: {
    icon: { type: String, default: '🎉' },
    primaryColor: { type: String, default: '#4f46e5' },
    secondaryColor: { type: String, default: '#c7d2fe' },
    accentColor: { type: String, default: '#fbbf24' },
    backgroundStyle: { type: String, default: 'glassmorphism' },
    backgroundGradient: { type: String, default: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' },
    animationStyle: { type: String, default: 'none' }, // petals, hearts, leaves, confetti, none
    typography: { type: String, default: 'Inter' },
    buttonStyle: { type: String, default: 'rounded-xl' },
    bannerStyle: { type: String, default: 'premium' },
    textColor: { type: String, default: '#ffffff' },
    subtextColor: { type: String, default: 'rgba(255, 255, 255, 0.8)' }
  },

  navigation: {
    showInHomepage: { type: Boolean, default: true },
    showInNavigationMenu: { type: Boolean, default: true },
    showInMobileNavbar: { type: Boolean, default: true },
    showInAnnouncementBar: { type: Boolean, default: true },
    showInFeaturedSection: { type: Boolean, default: true }
  },

  banners: { type: [seasonalBannerSchema], default: [] },
  categories: { type: [seasonalCategorySchema], default: [] },
  offers: { type: [seasonalOfferSchema], default: [] },

  delivery: {
    sameDayEnabled: { type: Boolean, default: true },
    sameDayCharge: { type: Number, default: 0 },
    sameDayCutoff: { type: String, default: '18:00' },
    midnightEnabled: { type: Boolean, default: true },
    midnightCharge: { type: Number, default: 150 },
    midnightCutoff: { type: String, default: '20:00' }
  },

  seo: {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    keywords: { type: [String], default: [] },
    ogImage: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' }
  },

  analytics: {
    orders: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    traffic: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Static seeder logic
seasonalCampaignSchema.statics.seedDefaultCampaigns = async function () {
  try {
    const count = await this.countDocuments();
    if (count > 0) return;

    console.log('🌱 Seeding default seasonal campaigns...');

    const defaults = [
      {
        name: "Mother's Day",
        slug: "mothers-day",
        theme: {
          icon: "🌸",
          primaryColor: "#db2777", // pink-600
          secondaryColor: "#fbcfe8", // pink-200
          accentColor: "#fbbf24",
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)",
          animationStyle: "petals",
          textColor: "#db2777", // pink-600
          subtextColor: "#470c24" // deep pink-950
        },
        categories: [
          { id: "moms-favorite-flowers", name: "Mom's Favorite Flowers", slug: "moms-favorite-flowers", order: 0 },
          { id: "luxury-bouquets-for-mom", name: "Luxury Bouquets for Mom", slug: "luxury-bouquets-for-mom", order: 1 },
          { id: "mothers-day-combos", name: "Mother's Day Combos", slug: "mothers-day-combos", order: 2 }
        ]
      },
      {
        name: "Father's Day",
        slug: "fathers-day",
        theme: {
          icon: "👨",
          primaryColor: "#0284c7", // sky-600
          secondaryColor: "#bae6fd", // sky-200
          accentColor: "#fbbf24",
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)",
          animationStyle: "none",
          textColor: "#0369a1", // sky-700
          subtextColor: "#083344" // sky-950
        },
        categories: [
          { id: "gifts-for-dad", name: "Gifts for Dad", slug: "gifts-for-dad", order: 0 },
          { id: "fathers-day-combos", name: "Father's Day Combos", slug: "fathers-day-combos", order: 1 },
          { id: "premium-gift-boxes", name: "Premium Gift Boxes", slug: "premium-gift-boxes", order: 2 }
        ]
      },
      {
        name: "Friendship Day",
        slug: "friendship-day",
        theme: {
          icon: "🤝",
          primaryColor: "#7c3aed", // violet-600
          secondaryColor: "#ddd6fe", // violet-200
          accentColor: "#fbbf24",
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ddd6fe 100%)",
          animationStyle: "confetti",
          textColor: "#6d28d9", // violet-700
          subtextColor: "#2e1065" // violet-950
        },
        categories: [
          { id: "friendship-bouquets", name: "Friendship Bouquets", slug: "friendship-bouquets", order: 0 },
          { id: "friendship-gifts", name: "Friendship Gifts", slug: "friendship-gifts", order: 1 },
          { id: "friendship-combos", name: "Friendship Combos", slug: "friendship-combos", order: 2 }
        ]
      },
      {
        name: "Raksha Bandhan",
        slug: "rakhi",
        theme: {
          icon: "🎁",
          primaryColor: "#ea580c", // orange-600
          secondaryColor: "#fed7aa", // orange-200
          accentColor: "#eab308",
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)",
          animationStyle: "confetti",
          textColor: "#c2410c", // orange-700
          subtextColor: "#431407" // orange-950
        },
        categories: [
          { id: "rakhi-specials", name: "Rakhi Specials", slug: "rakhi-specials", order: 0 },
          { id: "rakhi-gift-hampers", name: "Rakhi Gift Hampers", slug: "rakhi-gift-hampers", order: 1 },
          { id: "brother-sister-combos", name: "Brother-Sister Combos", slug: "brother-sister-combos", order: 2 }
        ]
      },
      {
        name: "Diwali",
        slug: "diwali",
        theme: {
          icon: "🪔",
          primaryColor: "#b91c1c", // red-700
          secondaryColor: "#fecaca", // red-200
          accentColor: "#fbbf24", // amber-400
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)",
          animationStyle: "confetti",
          textColor: "#b91c1c", // red-700
          subtextColor: "#450a0a" // red-950
        },
        categories: [
          { id: "festive-flowers", name: "Festive Flowers", slug: "festive-flowers", order: 0 },
          { id: "diwali-hampers", name: "Diwali Hampers", slug: "diwali-hampers", order: 1 },
          { id: "corporate-gifts", name: "Corporate Gifts", slug: "corporate-gifts", order: 2 }
        ]
      },
      {
        name: "New Year",
        slug: "new-year",
        theme: {
          icon: "🎉",
          primaryColor: "#4f46e5", // indigo-600
          secondaryColor: "#c7d2fe", // indigo-200
          accentColor: "#a78bfa",
          backgroundStyle: "glassmorphism",
          backgroundGradient: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)",
          animationStyle: "confetti",
          textColor: "#4338ca", // indigo-700
          subtextColor: "#1e1b4b" // indigo-950
        },
        categories: [
          { id: "new-year-bouquets", name: "New Year Bouquets", slug: "new-year-bouquets", order: 0 },
          { id: "celebration-gifts", name: "Celebration Gifts", slug: "celebration-gifts", order: 1 },
          { id: "party-combos", name: "Party Combos", slug: "party-combos", order: 2 }
        ]
      }
    ];

    for (const d of defaults) {
      const year = new Date().getFullYear();
      const created = await this.create({
        name: d.name,
        slug: d.slug,
        enabled: false, // Default is OFF
        general: {
          campaignName: `${d.name} Special Celebration`,
          startDate: new Date(year, 4, 1), // default placeholder
          endDate: new Date(year, 4, 30),
          countdownTargetDate: new Date(year, 4, 10)
        },
        theme: d.theme,
        navigation: {
          showInHomepage: true,
          showInNavigationMenu: true,
          showInMobileNavbar: true,
          showInAnnouncementBar: true,
          showInFeaturedSection: true
        },
        categories: d.categories,
        banners: [
          { id: `${d.slug}-hero`, title: `${d.name} Collection`, subtitle: `Celebrate ${d.name} with our beautiful flowers`, image: '', link: `/${d.slug}`, position: 'hero', enabled: true },
          { id: `${d.slug}-announcement`, title: `✨ Special ${d.name} offers are live!`, subtitle: 'Order now', link: `/${d.slug}`, position: 'announcement', enabled: true }
        ],
        offers: [
          { id: `${d.slug}-offer-1`, title: '15% Off Your First Campaign Purchase', code: `${d.slug.toUpperCase()}15`, type: 'discount', value: 15, enabled: true }
        ]
      });
      await this.syncOffers(created);
    }

    console.log('✅ Default seasonal campaigns seeded successfully!');
  } catch (error) {
    console.error('❌ Failed to seed default seasonal campaigns:', error);
  }
};

seasonalCampaignSchema.statics.syncOffers = async function (campaign, userId) {
  const PromoCode = require('./PromoCode');
  const User = require('./User');
  try {
    const campaignOffers = campaign.offers || [];
    
    // Find first admin if userId is not provided
    let creatorId = userId;
    if (!creatorId) {
      const adminUser = await User.findOne({ role: 'admin' });
      creatorId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();
    }

    // Get all current active promo codes for this campaign from database
    const existingPromoCodes = await PromoCode.find({
      'metadata.campaignName': campaign.name
    });

    const activeOfferCodes = campaignOffers
      .filter(o => o.code && o.enabled)
      .map(o => o.code.toUpperCase());

    // 1. Delete or deactivate promo codes that are no longer active in the campaign
    for (const pc of existingPromoCodes) {
      if (!activeOfferCodes.includes(pc.code)) {
        if (pc.usedCount > 0) {
          pc.isActive = false;
          await pc.save();
        } else {
          await PromoCode.findByIdAndDelete(pc._id);
        }
      }
    }

    // 2. Upsert active campaign offers as PromoCodes
    for (const offer of campaignOffers) {
      if (!offer.code || !offer.enabled) continue;

      const codeUpper = offer.code.toUpperCase();
      const validFrom = campaign.general?.startDate || new Date();
      const validUntil = campaign.general?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const updateData = {
        code: codeUpper,
        description: `${campaign.name} Campaign Offer: ${offer.title}`,
        discountType: offer.type === 'free-delivery' ? 'fixed' : 'percentage',
        discountValue: offer.type === 'free-delivery' ? 0 : offer.value,
        minimumOrderAmount: offer.minOrderAmount || 0,
        validFrom,
        validUntil,
        isActive: campaign.enabled && offer.enabled,
        metadata: {
          campaignName: campaign.name,
          notes: `Auto-synced from Seasonal Campaign (${campaign.slug})`
        }
      };

      const existing = await PromoCode.findOne({ code: codeUpper });
      if (existing) {
        Object.assign(existing, updateData);
        await existing.save();
      } else {
        const newPromo = new PromoCode({
          ...updateData,
          createdBy: creatorId
        });
        await newPromo.save();
      }
    }

    console.log(`✅ Synced offers for campaign "${campaign.name}" to PromoCode collection.`);
  } catch (error) {
    console.error(`❌ Failed to sync offers to PromoCodes for campaign "${campaign.name}":`, error);
  }
};

module.exports = mongoose.model('SeasonalCampaign', seasonalCampaignSchema);
