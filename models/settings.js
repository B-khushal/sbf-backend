const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  ctaText: {
    type: String,
    required: true
  },
  ctaLink: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    required: true
  }
});

const homeSectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['hero', 'categories', 'featured', 'new', 'philosophy', 'offers', 'custom']
  },
  enabled: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    required: true
  },
  title: String,
  subtitle: String,
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const categorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  image: String,
  link: String,
  enabled: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    required: true
  }
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
  navigationItems: [navigationItemSchema],
  searchPlaceholder: String,
  showWishlist: {
    type: Boolean,
    default: true
  },
  showCart: {
    type: Boolean,
    default: true
  },
  showCurrencyConverter: {
    type: Boolean,
    default: true
  }
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
  companyName: String,
  description: String,
  socialLinks: [socialLinkSchema],
  contactInfo: {
    email: String,
    phone: String,
    address: String
  },
  links: [footerSectionSchema],
  copyright: String,
  showMap: {
    type: Boolean,
    default: true
  },
  mapEmbedUrl: String
});

const settingsSchema = new mongoose.Schema({
  heroSlides: [heroSlideSchema],
  homeSections: [homeSectionSchema],
  categories: [categorySchema],
  shopCategories: [categorySchema],
  headerSettings: headerSettingsSchema,
  footerSettings: footerSettingsSchema,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create default settings if they don't exist
settingsSchema.statics.initializeDefaultSettings = async function() {
  const settings = await this.findOne();
  if (!settings) {
    const defaultHeroSlides = [
      {
        id: 1,
        title: "Spring Collection",
        subtitle: "Freshly picked arrangements to brighten your day",
        image: "/images/1.jpg",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        enabled: true,
        order: 0
      },
      {
        id: 2,
        title: "Signature Bouquets",
        subtitle: "Handcrafted with love and attention to detail",
        image: "/images/2.jpg",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        enabled: true,
        order: 1
      },
      {
        id: 3,
        title: "Seasonal Specials",
        subtitle: "Limited edition arrangements for every occasion",
        image: "/images/3.jpg",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        enabled: true,
        order: 2
      }
    ];

    const defaultSections = [
      { id: 'hero', type: 'hero', enabled: true, order: 0, title: 'Hero Section', subtitle: 'Main banner area' },
      { id: 'categories', type: 'categories', enabled: true, order: 1, title: 'Categories', subtitle: 'Product categories showcase' },
      { id: 'featured', type: 'featured', enabled: true, order: 2, title: '✨ Featured Collection', subtitle: 'Explore our most popular floral arrangements' },
      { id: 'offers', type: 'offers', enabled: true, order: 3, title: 'Special Offers', subtitle: 'Don\'t miss our amazing deals' },
      { id: 'new', type: 'new', enabled: true, order: 4, title: '🌸 New Arrivals', subtitle: 'Discover our latest seasonal additions' },
      { id: 'philosophy', type: 'philosophy', enabled: true, order: 5, title: 'Artfully Crafted Botanical Experiences', subtitle: 'Every arrangement we create is a unique work of art, designed to bring beauty and tranquility into your everyday spaces.', content: { image: '/images/d3.jpg' } }
    ];

    const defaultCategories = [
      {
        id: "premium-roses",
        name: "Premium Roses",
        description: "Symbol of eternal love and beauty",
        image: "/images/roses-1.png",
        link: "/shop/roses",
        enabled: true,
        order: 0
      },
      {
        id: "exotic-orchids",
        name: "Exotic Orchids",
        description: "Sophisticated elegance and grace",
        image: "/images/p-orchid.png",
        link: "/shop/orchids",
        enabled: true,
        order: 1
      },
      {
        id: "graceful-lilies",
        name: "Graceful Lilies",
        description: "Pure serenity and tranquility",
        image: "/images/p-lilly.png",
        link: "/shop/lilies",
        enabled: true,
        order: 2
      },
      {
        id: "classic-carnations",
        name: "Classic Carnations",
        description: "Timeless beauty and charm",
        image: "/images/p-carnation.png",
        link: "/shop/carnations",
        enabled: true,
        order: 3
      },
      {
        id: "sunshine-flowers",
        name: "Sunshine Flowers",
        description: "Radiant happiness and joy",
        image: "/images/p-sunflower.png",
        link: "/shop/sunflowers",
        enabled: true,
        order: 4
      }
    ];

    const defaultShopCategories = [
      {
        id: "shop-premium-roses",
        name: "Premium Roses",
        description: "Symbol of eternal love and beauty",
        image: "/images/roses-1.png",
        link: "/shop/roses",
        enabled: true,
        order: 0
      },
      {
        id: "shop-exotic-orchids",
        name: "Exotic Orchids",
        description: "Sophisticated elegance and grace",
        image: "/images/p-orchid.png",
        link: "/shop/orchids",
        enabled: true,
        order: 1
      },
      {
        id: "shop-graceful-lilies",
        name: "Graceful Lilies",
        description: "Pure serenity and tranquility",
        image: "/images/p-lilly.png",
        link: "/shop/lilies",
        enabled: true,
        order: 2
      },
      {
        id: "shop-classic-carnations",
        name: "Classic Carnations",
        description: "Timeless beauty and charm",
        image: "/images/p-carnation.png",
        link: "/shop/carnations",
        enabled: true,
        order: 3
      },
      {
        id: "shop-sunshine-flowers",
        name: "Sunshine Flowers",
        description: "Radiant happiness and joy",
        image: "/images/p-sunflower.png",
        link: "/shop/sunflowers",
        enabled: true,
        order: 4
      }
    ];

    const defaultHeaderSettings = {
      logo: "/images/logosbf.png",
      navigationItems: [
        { id: "shop", label: "Shop", href: "/shop", enabled: true, order: 0 },
        { id: "about", label: "About", href: "/about", enabled: true, order: 1 },
        { id: "contact", label: "Contact", href: "/contact", enabled: true, order: 2 }
      ],
      searchPlaceholder: "Search for flowers...",
      showWishlist: true,
      showCart: true,
      showCurrencyConverter: true
    };

    const defaultFooterSettings = {
      companyName: "Spring Blossoms Florist",
      description: "Curated floral arrangements and botanical gifts for every occasion, crafted with care and delivered with love.",
      socialLinks: [
        { platform: "Instagram", url: "https://www.instagram.com/sbf_india", enabled: true },
        { platform: "Facebook", url: "#", enabled: true },
        { platform: "Twitter", url: "#", enabled: true }
      ],
      contactInfo: {
        email: "2006sbf@gmail.com",
        phone: "+91 9849589710",
        address: "Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32,Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028"
      },
      links: [
        {
          section: "Shop",
          items: [
            { label: "Bouquets", href: "/shop/bouquets", enabled: true },
            { label: "Seasonal", href: "/shop/seasonal", enabled: true },
            { label: "Sale", href: "/shop/sale", enabled: true }
          ]
        },
        {
          section: "Company",
          items: [
            { label: "About Us", href: "/about", enabled: true },
            { label: "Blog", href: "/blog", enabled: true },
            { label: "Contact", href: "/contact", enabled: true }
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} Spring Blossoms Florist. All rights reserved.`,
      showMap: true,
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.3484898316306!2d78.43144207424317!3d17.395055702585967!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb971c17e5196b%3A0x78305a92a4153749!2sSpring%20Blossoms%20Florist!5e0!3m2!1sen!2sin!4v1744469050804!5m2!1sen!2sin"
    };

    await this.create({ 
      heroSlides: defaultHeroSlides,
      homeSections: defaultSections,
      categories: defaultCategories,
      shopCategories: defaultShopCategories,
      headerSettings: defaultHeaderSettings,
      footerSettings: defaultFooterSettings
    });
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings; 