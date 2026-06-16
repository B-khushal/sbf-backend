const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  image: { type: String, required: true },
  mobileImage: { type: String, default: '' },
  ctaText: { type: String, required: true },
  ctaLink: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  order: { type: Number, required: true },
  textColor: { type: String, default: '#ffffff' },
  overlayOpacity: { type: Number, default: 0.4 },
  animationType: { type: String, default: 'fade' },
  schedulePublishStart: { type: Date, default: null },
  schedulePublishEnd: { type: Date, default: null },
  languages: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const mobileBannerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  image: { type: String, default: '' },
  link: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  schedulePublishStart: { type: Date, default: null },
  schedulePublishEnd: { type: Date, default: null }
});

const promoBannerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  image: { type: String, default: '' },
  link: { type: String, default: '' },
  badge: { type: String, default: '' },
  ctaText: { type: String, default: 'Shop Now' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});


const homeSectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [
      'hero', 'categories', 'featured', 'new', 'philosophy', 'offers', 'custom',
      'bestsellers', 'seasonal', 'testimonials', 'about', 'gallery', 'instagram',
      'blogs', 'custom_html', 'video_section', 'countdown_banner', 'whychooseus', 'social'
    ]
  },
  enabled: { type: Boolean, default: true },
  order: { type: Number, required: true },
  title: String,
  subtitle: String,
  visibility: {
    desktop: { type: Boolean, default: true },
    tablet: { type: Boolean, default: true },
    mobile: { type: Boolean, default: true }
  },
  styling: {
    background: { type: String, default: '' },
    padding: { type: String, default: 'py-16' },
    spacing: { type: String, default: 'mb-0' },
    animation: { type: String, default: 'fadeIn' }
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  image: String,
  link: String,
  enabled: { type: Boolean, default: true },
  order: { type: Number, required: true },
  slug: { type: String, default: '' },
  priority: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  colorTheme: { type: String, default: '' },
  parentId: { type: String, default: null },
  mobileOrder: { type: Number, default: 0 }
});

const navigationItemSchema = new mongoose.Schema({
  id: String,
  label: String,
  href: String,
  enabled: { type: Boolean, default: true },
  order: Number,
  submenu: { type: mongoose.Schema.Types.Mixed, default: [] } // Dropdowns/mega menu
});

const headerSettingsSchema = new mongoose.Schema({
  logo: String,
  stickyLogo: { type: String, default: '' },
  mobileLogo: { type: String, default: '' },
  announcementBar: {
    enabled: { type: Boolean, default: true },
    text: { type: String, default: 'Use code SBF10 to get an exclusive discount — only on your first order! 🌸' },
    texts: { type: [String], default: ['Use code SBF10 to get an exclusive discount — only on your first order! 🌸'] },
    link: { type: String, default: '' },
    bgColor: { type: String, default: 'linear-gradient(to right, #7dd3fc, #f9a8d4, #86efac)' },
    textColor: { type: String, default: '#ffffff' }
  },
  scrollingTicker: {
    enabled: { type: Boolean, default: false },
    texts: { type: [String], default: [] },
    speed: { type: Number, default: 25 }
  },
  navigationItems: [navigationItemSchema],
  searchPlaceholder: String,
  showWishlist: { type: Boolean, default: true },
  showCart: { type: Boolean, default: true },
  showCurrencyConverter: { type: Boolean, default: true },
  showLanguageSelector: { type: Boolean, default: false },
  stickyHeader: { type: Boolean, default: true },
  transparentHeader: { type: Boolean, default: false },
  mobileHeaderStyle: { type: String, default: 'default' }
});

const socialLinkSchema = new mongoose.Schema({
  platform: String,
  url: String,
  enabled: { type: Boolean, default: true }
});

const footerLinkSchema = new mongoose.Schema({
  label: String,
  href: String,
  enabled: { type: Boolean, default: true }
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
  showMap: { type: Boolean, default: true },
  mapEmbedUrl: String,
  newsletter: {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'Subscribe to Our Newsletter' },
    placeholder: { type: String, default: 'Enter your email' }
  },
  paymentIcons: { type: [String], default: ['visa', 'mastercard', 'upi', 'razorpay'] },
  trustBadges: {
    type: [
      {
        icon: { type: String },
        text: { type: String }
      }
    ],
    default: [
      { icon: 'Truck', text: 'Free Delivery' },
      { icon: 'ShieldCheck', text: 'Secure Payment' },
      { icon: 'Gift', text: 'Special Offers' },
      { icon: 'Heart', text: 'Made with Love' }
    ]
  },
  seoFooterText: { type: String, default: '' },
  appDownloadButtons: {
    enabled: { type: Boolean, default: false },
    androidLink: { type: String, default: '' },
    iosLink: { type: String, default: '' }
  },
  backgroundStyle: { type: String, default: 'default' },
  securePaymentEnabled: { type: Boolean, default: true },
  securePaymentHeaderText: { type: String, default: 'Secure Payments by' },
  securePaymentHighlightText: { type: String, default: '100% Safe & Encrypted Transactions' },
  securePaymentGatewayText: { type: String, default: 'Trusted Payment Gateway' },
  securePaymentTrustText: { type: String, default: 'Trusted by Millions of Businesses' },
  securePaymentLogoType: { type: String, default: 'default' },
  securePaymentCustomLogo: { type: String, default: '' },
  paymentMethodUpiEnabled: { type: Boolean, default: true },
  paymentMethodUpiType: { type: String, default: 'default' },
  paymentMethodUpiUrl: { type: String, default: '' },
  paymentMethodVisaEnabled: { type: Boolean, default: true },
  paymentMethodVisaType: { type: String, default: 'default' },
  paymentMethodVisaUrl: { type: String, default: '' },
  paymentMethodMastercardEnabled: { type: Boolean, default: true },
  paymentMethodMastercardType: { type: String, default: 'default' },
  paymentMethodMastercardUrl: { type: String, default: '' },
  paymentMethodRuPayEnabled: { type: Boolean, default: true },
  paymentMethodRuPayType: { type: String, default: 'default' },
  paymentMethodRuPayUrl: { type: String, default: '' },
  paymentMethodNetBankingEnabled: { type: Boolean, default: true },
  paymentMethodNetBankingType: { type: String, default: 'default' },
  paymentMethodNetBankingUrl: { type: String, default: '' },
  paymentMethodWalletsEnabled: { type: Boolean, default: true },
  paymentMethodWalletsType: { type: String, default: 'default' },
  paymentMethodWalletsUrl: { type: String, default: '' },
  paymentMethodEmiEnabled: { type: Boolean, default: true },
  paymentMethodEmiType: { type: String, default: 'default' },
  paymentMethodEmiUrl: { type: String, default: '' }
});

const notificationsSettingsSchema = new mongoose.Schema({
  whatsappFloating: {
    enabled: { type: Boolean, default: true },
    phoneNumber: { type: String, default: '9949683222' },
    position: { type: String, default: 'right' },
    message: { type: String, default: "Hello! I'm interested in your flower arrangements." },
    showHoverCard: { type: Boolean, default: true },
    showFloatingAnimation: { type: Boolean, default: true },
    businessName: { type: String, default: 'Spring Blossoms Florist' },
    widgetTitle: { type: String, default: 'WhatsApp Us' },
    widgetSubtitle: { type: String, default: 'Need help choosing flowers?' },
    widgetSize: { type: String, default: 'medium' },
    iconStyle: { type: String, default: 'circle' },
    borderRadius: { type: Number, default: 12 },
    shadowIntensity: { type: String, default: 'medium' },
    welcomeText: { type: String, default: 'Chat with our floral experts.' },
    ctaButtonText: { type: String, default: 'Chat Now' },
    onlineStatusText: { type: String, default: 'Online' },
    businessHoursMessage: { type: String, default: 'Typically replies within minutes' },
    showOnlyOnHomepage: { type: Boolean, default: false },
    showOnValentineLanding: { type: Boolean, default: false }
  },
  popupCreator: {
    enabled: { type: Boolean, default: false },
    image: { type: String, default: '' },
    title: { type: String, default: 'Special Offer!' },
    subtitle: { type: String, default: 'Get 10% off your first purchase' },
    ctaText: { type: String, default: 'Shop Now' },
    ctaLink: { type: String, default: '/shop' },
    scheduleStart: { type: Date, default: null },
    scheduleEnd: { type: Date, default: null }
  },
  exitIntentPopup: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Wait! Don\'t Go Empty Handed' },
    subtitle: { type: String, default: 'Use code EXIT10 for 10% off!' },
    discountCode: { type: String, default: 'EXIT10' }
  }
});

const globalSettingsSchema = new mongoose.Schema({
  websiteTitle: { type: String, default: 'Spring Blossoms Florist | Online Flower Delivery Hyderabad' },
  metaTitle: { type: String, default: 'Spring Blossoms Florist - Best Florist in Hyderabad' },
  metaDescription: { type: String, default: 'Online bouquet shop India offering midnight flower delivery, roses for anniversary, birthday flowers online. Send flowers online with the best florist in Hyderabad.' },
  favicon: { type: String, default: '/favicon.ico' },
  openGraph: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' }
  },
  googleAnalyticsId: { type: String, default: '' },
  facebookPixelId: { type: String, default: '' },
  robotsTxt: { type: String, default: 'User-agent: *\nAllow: /' },
  sitemapUrl: { type: String, default: '/sitemap.xml' },
  schemaMarkup: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  customHeadCode: { type: String, default: '' },
  customBodyCode: { type: String, default: '' }
});

const deliverySettingsSchema = new mongoose.Schema({
  firstOrderFree: { type: Boolean, default: true },
  deliveryChargeRules: {
    type: [
      {
        minOrderAmount: Number,
        charge: Number
      }
    ],
    default: [
      { minOrderAmount: 0, charge: 150 },
      { minOrderAmount: 999, charge: 0 }
    ]
  },
  zones: {
    type: [
      {
        name: String,
        zipcodes: [String],
        charge: Number
      }
    ],
    default: []
  },
  timeSlots: {
    type: [
      {
        time: String,
        enabled: Boolean,
        label: String,
        extraCharge: Number
      }
    ],
    default: [
      { time: 'standard', enabled: true, label: 'Standard Delivery (9 AM - 9 PM)', extraCharge: 0 },
      { time: 'midnight', enabled: true, label: 'Midnight Delivery (11:30 PM - 12:30 AM)', extraCharge: 150 }
    ]
  },
  freeDeliveryConditions: {
    minAmount: { type: Number, default: 999 },
    enabled: { type: Boolean, default: true }
  },
  rushDelivery: {
    enabled: { type: Boolean, default: false },
    charge: { type: Number, default: 100 }
  },
  tickerMessage: { type: String, default: 'Same-day flower delivery in Hyderabad. Free delivery on orders above ₹999!' }
});

const themeSettingsSchema = new mongoose.Schema({
  primaryColor: { type: String, default: '200 100% 75%' }, // HSL string format
  secondaryColor: { type: String, default: '320 60% 85%' },
  accentColor: { type: String, default: '140 50% 80%' },
  gradientStart: { type: String, default: '#7dd3fc' },
  gradientEnd: { type: String, default: '#f9a8d4' },
  gradients: {
    primary: { type: String, default: 'linear-gradient(to right, #7dd3fc, #f9a8d4)' },
    secondary: { type: String, default: 'linear-gradient(to right, #f9a8d4, #86efac)' },
    card: { type: String, default: 'linear-gradient(to bottom right, rgba(255,255,255,0.8), rgba(255,255,255,0.4))' }
  },
  fontFamily: { type: String, default: 'Inter' },
  borderRadius: { type: Number, default: 0.75 }, // in rem
  buttonStyle: { type: String, default: 'rounded-xl' },
  cardStyle: { type: String, default: 'glassmorphism' },
  shadowGlowStyle: { type: String, default: 'subtle' },
  layoutWidth: { type: String, default: 'max-w-7xl' },
  animationIntensity: { type: String, default: 'normal' },
  themePreset: { type: String, default: 'classic-bloom' },
  palette: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      primaryHex: '#7dd3fc',
      secondaryHex: '#f9a8d4',
      accentHex: '#86efac'
    }
  }
});

const productDisplaySettingsSchema = new mongoose.Schema({
  cardLayout: { type: String, default: 'standard' },
  gridColumnsDesktop: { type: Number, default: 4 },
  gridColumnsMobile: { type: Number, default: 2 },
  imageAspectRatio: { type: String, default: '1:1' },
  hoverAnimation: { type: String, default: 'zoom' },
  discountBadgeStyle: { type: String, default: 'percentage' },
  wishlistToggle: { type: Boolean, default: true },
  quickViewToggle: { type: Boolean, default: true },
  ratingsToggle: { type: Boolean, default: true },
  productLabels: { type: [String], default: ['New', 'Hot', 'Sale'] }
});

const settingsSchema = new mongoose.Schema({
  heroSlides: [heroSlideSchema],
  mobileBanners: [mobileBannerSchema],
  promoBanners: [promoBannerSchema],
  homeSections: [homeSectionSchema],
  categories: [categorySchema],
  shopCategories: [categorySchema],
  headerSettings: headerSettingsSchema,
  footerSettings: footerSettingsSchema,
  notificationsSettings: {
    type: notificationsSettingsSchema,
    default: () => ({})
  },
  globalSettings: {
    type: globalSettingsSchema,
    default: () => ({})
  },
  deliverySettings: {
    type: deliverySettingsSchema,
    default: () => ({})
  },
  themeSettings: {
    type: themeSettingsSchema,
    default: () => ({})
  },
  productDisplaySettings: {
    type: productDisplaySettingsSchema,
    default: () => ({})
  },
  draftSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  history: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
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
        order: 0,
        mobileImage: '',
        textColor: '#ffffff',
        overlayOpacity: 0.4,
        animationType: 'fade'
      },
      {
        id: 2,
        title: "Signature Bouquets",
        subtitle: "Handcrafted with love and attention to detail",
        image: "/images/2.jpg",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        enabled: true,
        order: 1,
        mobileImage: '',
        textColor: '#ffffff',
        overlayOpacity: 0.4,
        animationType: 'fade'
      },
      {
        id: 3,
        title: "Seasonal Specials",
        subtitle: "Limited edition arrangements for every occasion",
        image: "/images/3.jpg",
        ctaText: "Shop Now",
        ctaLink: "/shop",
        enabled: true,
        order: 2,
        mobileImage: '',
        textColor: '#ffffff',
        overlayOpacity: 0.4,
        animationType: 'fade'
      }
    ];

    const defaultSections = [
      { id: 'hero', type: 'hero', enabled: true, order: 0, title: 'Hero Section', subtitle: 'Main banner area' },
      { id: 'categories', type: 'categories', enabled: true, order: 1, title: 'Categories', subtitle: 'Product categories showcase' },
      {
        id: 'whychooseus',
        type: 'whychooseus',
        enabled: true,
        order: 2,
        title: 'Why Discerning Gift-Givers Choose Us',
        subtitle: 'We elevate floral gifting into memorable luxury experiences, delivering beauty and joy with meticulous attention to detail.',
        content: {
          items: [
            {
              title: 'Same-Day Hand Delivery',
              description: 'Freshness delivered directly to Hyderabad homes by our personal couriers.',
              icon: 'Truck',
              bg: 'from-sky-50 to-blue-50/30',
              iconColor: 'text-sky-500 bg-sky-100/50'
            },
            {
              title: '7-Day Freshness Guarantee',
              description: 'We source directly from premium growers to ensure lasting floral vibrancy.',
              icon: 'Sparkles',
              bg: 'from-pink-50 to-rose-50/30',
              iconColor: 'text-pink-500 bg-pink-100/50'
            },
            {
              title: '100% Safe Payments',
              description: 'We use enterprise bank-grade security to protect your transactions and details.',
              icon: 'ShieldCheck',
              bg: 'from-emerald-50 to-teal-50/30',
              iconColor: 'text-emerald-500 bg-emerald-100/50'
            },
            {
              title: 'Artisan Floral Designs',
              description: 'Each arrangement is uniquely crafted with artistic passion and care.',
              icon: 'Heart',
              bg: 'from-purple-50 to-indigo-50/30',
              iconColor: 'text-purple-500 bg-purple-100/50'
            }
          ]
        }
      },
      { id: 'featured', type: 'featured', enabled: true, order: 3, title: '✨ Featured Collection', subtitle: 'Explore our most popular floral arrangements' },
      {
        id: 'offers',
        type: 'offers',
        enabled: true,
        order: 4,
        title: 'Perfect Gifts for Cherished Moments',
        subtitle: 'Discover handpicked floral collections designed to convey every shade of sentiment.',
        content: {
          items: [
            {
              id: 'birthday',
              title: 'The Birthday Collection',
              subtitle: 'Make their day unforgettable with vibrant colors and sweet combos.',
              image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=800',
              link: '/shop?category=birthday',
              gridClass: 'md:col-span-2 md:row-span-1',
              badge: '🎉 Festive',
              icon: 'Sparkles'
            },
            {
              id: 'anniversary',
              title: 'Romantic Anniversary Gifts',
              subtitle: 'Express everlasting love with classic roses and luxury hampers.',
              image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=800',
              link: '/shop?category=anniversary',
              gridClass: 'md:col-span-1 md:row-span-2',
              badge: '💖 Best Seller',
              icon: 'Heart'
            },
            {
              id: 'midnight',
              title: 'Midnight Delivery Specials',
              subtitle: 'Surprise them right at 12:00 AM with fresh bouquets.',
              image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=800',
              link: '/shop?category=roses',
              gridClass: 'md:col-span-1 md:row-span-1',
              badge: '🌙 Midnight',
              icon: 'Clock'
            },
            {
              id: 'luxury',
              title: 'Luxury Floral Masterpieces',
              subtitle: 'Elite arrangements curated by master designers using exotic blossoms.',
              image: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=800',
              link: '/shop?category=premium-collections',
              gridClass: 'md:col-span-2 md:row-span-1',
              badge: '✨ Luxury',
              icon: 'Star'
            },
            {
              id: 'personalized',
              title: 'Personalized Custom Gifts',
              subtitle: 'Custom photo cards, printed cushions, and floral gift sets.',
              image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=800',
              link: '/shop?category=hampers',
              gridClass: 'md:col-span-1 md:row-span-1',
              badge: '🎁 Custom',
              icon: 'Gift'
            }
          ]
        }
      },
      { id: 'new', type: 'new', enabled: true, order: 5, title: '🌸 New Arrivals', subtitle: 'Discover our latest seasonal additions' },
      { id: 'philosophy', type: 'philosophy', enabled: true, order: 6, title: 'Artfully Crafted Botanical Experiences', subtitle: 'Every arrangement we create is a unique work of art, designed to bring beauty and tranquility into your everyday spaces.', content: { image: '/images/d3.jpg' } },
      {
        id: 'social',
        type: 'social',
        enabled: true,
        order: 7,
        title: 'Share Your Joy #SBFlorist',
        subtitle: 'See how our customers celebrate life\'s moments. Follow us on Instagram for daily bouquet inspiration.',
        content: {
          instagramUrl: 'https://www.instagram.com/sbf_india',
          items: [
            {
              id: 1,
              type: 'post',
              image: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&q=80&w=600',
              likes: '412',
              comments: '28'
            },
            {
              id: 2,
              type: 'reel',
              image: 'https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&q=80&w=600',
              likes: '1.2k',
              comments: '64',
              views: '8.4k'
            },
            {
              id: 3,
              type: 'post',
              image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&q=80&w=600',
              likes: '350',
              comments: '12'
            },
            {
              id: 4,
              type: 'reel',
              image: 'https://images.unsplash.com/photo-1508784411316-02b8cd4d3a3a?auto=format&fit=crop&q=80&w=600',
              likes: '890',
              comments: '36',
              views: '5.2k'
            },
            {
              id: 5,
              type: 'post',
              image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=600',
              likes: '512',
              comments: '40'
            },
            {
              id: 6,
              type: 'post',
              image: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?auto=format&fit=crop&q=80&w=600',
              likes: '298',
              comments: '18'
            }
          ]
        }
      }
    ];

    const defaultCategories = [
      {
        id: "premium-roses",
        name: "Premium Roses",
        description: "Symbol of eternal love and beauty",
        image: "/images/roses-1.png",
        link: "/shop/roses",
        enabled: true,
        order: 0,
        slug: 'roses',
        featured: true,
        priority: 1
      },
      {
        id: "exotic-orchids",
        name: "Exotic Orchids",
        description: "Sophisticated elegance and grace",
        image: "/images/p-orchid.png",
        link: "/shop/orchids",
        enabled: true,
        order: 1,
        slug: 'orchids',
        featured: true,
        priority: 2
      },
      {
        id: "graceful-lilies",
        name: "Graceful Lilies",
        description: "Pure serenity and tranquility",
        image: "/images/p-lilly.png",
        link: "/shop/lilies",
        enabled: true,
        order: 2,
        slug: 'lilies',
        featured: true,
        priority: 3
      },
      {
        id: "classic-carnations",
        name: "Classic Carnations",
        description: "Timeless beauty and charm",
        image: "/images/p-carnation.png",
        link: "/shop/carnations",
        enabled: true,
        order: 3,
        slug: 'carnations',
        featured: false,
        priority: 4
      },
      {
        id: "sunshine-flowers",
        name: "Sunshine Flowers",
        description: "Radiant happiness and joy",
        image: "/images/p-sunflower.png",
        link: "/shop/sunflowers",
        enabled: true,
        order: 4,
        slug: 'sunflowers',
        featured: false,
        priority: 5
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
        order: 0,
        slug: 'roses',
        featured: true,
        priority: 1
      },
      {
        id: "shop-exotic-orchids",
        name: "Exotic Orchids",
        description: "Sophisticated elegance and grace",
        image: "/images/p-orchid.png",
        link: "/shop/orchids",
        enabled: true,
        order: 1,
        slug: 'orchids',
        featured: true,
        priority: 2
      },
      {
        id: "shop-graceful-lilies",
        name: "Graceful Lilies",
        description: "Pure serenity and tranquility",
        image: "/images/p-lilly.png",
        link: "/shop/lilies",
        enabled: true,
        order: 2,
        slug: 'lilies',
        featured: true,
        priority: 3
      },
      {
        id: "shop-classic-carnations",
        name: "Classic Carnations",
        description: "Timeless beauty and charm",
        image: "/images/p-carnation.png",
        link: "/shop/carnations",
        enabled: true,
        order: 3,
        slug: 'carnations',
        featured: false,
        priority: 4
      },
      {
        id: "shop-sunshine-flowers",
        name: "Sunshine Flowers",
        description: "Radiant happiness and joy",
        image: "/images/p-sunflower.png",
        link: "/shop/sunflowers",
        enabled: true,
        order: 4,
        slug: 'sunflowers',
        featured: false,
        priority: 5
      }
    ];

    const defaultHeaderSettings = {
      logo: "/images/logosbf.png",
      stickyLogo: "/images/logosbf.png",
      mobileLogo: "/images/logosbf.png",
      announcementBar: {
        enabled: true,
        text: 'Use code SBF10 to get an exclusive discount — only on your first order! 🌸',
        texts: ['Use code SBF10 to get an exclusive discount — only on your first order! 🌸'],
        link: '',
        bgColor: 'linear-gradient(to right, #7dd3fc, #f9a8d4, #86efac)',
        textColor: '#ffffff'
      },
      navigationItems: [
        { id: "shop", label: "Shop", href: "/shop", enabled: true, order: 0 },
        { id: "about", label: "About", href: "/about", enabled: true, order: 1 },
        { id: "contact", label: "Contact", href: "/contact", enabled: true, order: 2 }
      ],
      searchPlaceholder: "Search for flowers...",
      showWishlist: true,
      showCart: true,
      showCurrencyConverter: true,
      showLanguageSelector: false,
      stickyHeader: true,
      transparentHeader: false,
      mobileHeaderStyle: 'default'
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
        phone: "+91 9949683222",
        address: "Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028"
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
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.3484898316306!2d78.43144207424317!3d17.395055702585967!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb971c17e5196b%3A0x78305a92a4153749!2sSpring%20Blossoms%20Florist!5e0!3m2!1sen!2sin!4v1744469050804!5m2!1sen!2sin",
      newsletter: {
        enabled: true,
        title: 'Subscribe to Our Newsletter',
        placeholder: 'Enter your email'
      },
      paymentIcons: ['visa', 'mastercard', 'upi', 'razorpay'],
      trustBadges: [
        { icon: 'Truck', text: 'Free Delivery' },
        { icon: 'ShieldCheck', text: 'Secure Payment' },
        { icon: 'Gift', text: 'Special Offers' },
        { icon: 'Heart', text: 'Made with Love' }
      ]
    };

    const defaultMobileBanners = [
      {
        id: "mb-1",
        title: "FREE DELIVERY!!",
        subtitle: "On eligible delivery slots",
        image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=800",
        link: "/shop",
        enabled: true,
        order: 0,
        schedulePublishStart: null,
        schedulePublishEnd: null
      },
      {
        id: "mb-2",
        title: "SAME DAY DELIVERY",
        subtitle: "Order before 6 PM",
        image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=800",
        link: "/shop",
        enabled: true,
        order: 1,
        schedulePublishStart: null,
        schedulePublishEnd: null
      }
    ];
    const defaultPromoBanners = [
      {
        id: "pb-1",
        title: "Anniversary Collection",
        subtitle: "Celebrate love with standard rose arrangements and luxury gifts.",
        image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=600",
        link: "/shop?category=anniversary",
        badge: "Same-day Delivery",
        ctaText: "Send Romance Gifts",
        enabled: true,
        order: 0
      },
      {
        id: "pb-2",
        title: "Luxury Handcrafted Bouquets",
        subtitle: "Exceptional designs from premium exotic local and imported flowers.",
        image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&q=80&w=600",
        link: "/shop?category=premium-collections",
        badge: "👑 Premium",
        ctaText: "Explore Elite Store",
        enabled: true,
        order: 1
      }
    ];

    await this.create({ 
      heroSlides: defaultHeroSlides,
      mobileBanners: defaultMobileBanners,
      promoBanners: defaultPromoBanners,
      homeSections: defaultSections,
      categories: defaultCategories,
      shopCategories: defaultShopCategories,
      headerSettings: defaultHeaderSettings,
      footerSettings: defaultFooterSettings,
      notificationsSettings: {},
      globalSettings: {},
      deliverySettings: {},
      themeSettings: {},
      productDisplaySettings: {}
    });
  }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;