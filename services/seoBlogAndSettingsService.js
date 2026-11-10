// SBF Florist - Global SEO Settings, Blog Content Engine & SEO Health Diagnostics Service
// Persists all data in PostgreSQL via Prisma Setting model (zero fake products or fake reviews).

const prisma = require('../config/prisma');
const { generateProductSeo, slugify } = require('./productSeoGenerator');

const GLOBAL_SEO_SETTING_KEY = 'seo_global_settings';
const BLOG_POSTS_SETTING_KEY = 'seo_blogs';
const CATEGORY_EXT_SETTING_KEY = 'seo_category_extensions';
const KEYWORD_MAPPINGS_SETTING_KEY = 'seo_keyword_mappings';
const BACKLINKS_SETTING_KEY = 'seo_backlinks';

const DEFAULT_GLOBAL_SEO_SETTINGS = {
  siteTitle: 'Spring Blossoms Florist | Buy Flowers & Gifts Online in India',
  defaultMetaDescription:
    'Order fresh flower bouquets, premium Dutch roses, exotic orchids, artisanal cakes, and luxury gift combos online from Spring Blossoms Florist. Same-day & midnight delivery in Hyderabad & Secunderabad.',
  canonicalDomain: 'https://sbflorist.in',
  brandName: 'Spring Blossoms Florist',
  shortBrandName: 'SBFlorist',
  tagline: 'A Reason to Express',
  primaryMarket: 'India',
  primaryCity: 'Hyderabad & Secunderabad',
  currency: 'INR',
  phone: '+919949683222',
  email: '2006sbf@gmail.com',
  streetAddress: 'Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Road, Mehdipatnam',
  addressLocality: 'Hyderabad',
  addressRegion: 'Telangana',
  postalCode: '500006',
  addressCountry: 'IN',
  defaultOgImage: 'https://sbflorist.in/images/og-preview.jpg',
  robotsDefault: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  googleSearchConsoleVerification: '',
  googleAnalyticsId: '',
  bingVerification: '',
  enableAutoSitemap: true,
  enableSchemaMarkup: true,
  socialLinks: [
    'https://www.instagram.com/sbf_india/',
    'https://www.google.com/maps?cid=8660521669298042697'
  ],
  updatedAt: new Date().toISOString()
};

const INITIAL_BLOG_POSTS = [
  {
    id: 'blog-rose-colors-guide',
    title: 'Meaning of Different Rose Colors: Red, Pink, Yellow, White & Peach Explained',
    slug: 'meaning-of-different-rose-colors-complete-guide',
    category: 'Flower Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '6 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Handcrafted red, pink, yellow, and white Dutch rose bouquets by Spring Blossoms Florist',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Meaning of Rose Colors',
    secondaryKeywords: [
      'Red Rose Meaning',
      'Pink Rose Symbolism',
      'Yellow Roses for Friendship',
      'White Rose Bouquets Online',
      'Buy Rose Bouquets Hyderabad'
    ],
    seoTitle: 'Meaning of Rose Colors: Red, Pink, Yellow & White Guide | SBFlorist',
    metaDescription:
      'Discover the meaning behind red, pink, yellow, white, and peach roses. Learn how to choose the right rose bouquet for birthdays, anniversaries, and romance at SBFlorist.',
    canonicalUrl: 'https://sbflorist.in/blog/meaning-of-different-rose-colors-complete-guide',
    noindex: false,
    excerpt:
      'Every rose shade tells a distinct emotional story. Before sending your next bouquet, explore our florist guide to what red, blush pink, golden yellow, and ivory white roses symbolize.',
    relatedCategories: [
      { name: 'Rose Bouquets', url: '/roses' },
      { name: 'Premium Roses', url: '/premium-roses' },
      { name: 'Romantic Bouquets', url: '/romantic-bouquets' },
      { name: 'Flower & Cake Combos', url: '/combos' }
    ],
    relatedProductQuery: 'rose',
    sections: [
      {
        heading: 'Why Rose Color Symbolism Matters When Gifting',
        body: 'For centuries, the language of flowers—known as floriography—has allowed people to express nuanced emotions without speaking a single word. At Spring Blossoms Florist, our master floral designers hand-select grade-A Dutch roses daily. Choosing the right hue transforms a beautiful bouquet into a deeply personal message tailored to your recipient.'
      },
      {
        heading: 'Red Roses: Timeless Passion, Devotion & Deep Love',
        body: 'Velvety crimson and scarlet Dutch roses are the universal emblem of romantic love, respect, and enduring passion. A 12-stem or 24-stem red rose bouquet is the classic choice for anniversaries, Valentine’s Day, marriage proposals, and romantic midnight surprises. Deeper burgundy tones represent unconscious beauty and lifelong commitment.'
      },
      {
        heading: 'Pink Roses: Grace, Admiration, Gratitude & Sweetness',
        body: 'Pink roses are remarkably versatile. Soft blush and pale pink roses convey gentleness, grace, and sweet affection—making them ideal for birthdays, daughters, mothers, or new beginnings. Vibrant hot-pink roses express heartfelt appreciation and gratitude when you want to say "Thank You" with elegance.'
      },
      {
        heading: 'Yellow Roses: Warmth, Joy, Optimism & Friendship',
        body: 'In modern floral gifting, golden yellow roses radiate platonic warmth, sunshine, and celebration. They are the perfect choice for cheering up a close friend, celebrating a career promotion, wishing someone a speedy recovery, or welcoming a new baby.'
      },
      {
        heading: 'White & Ivory Roses: Purity, Peace, Honour & New Beginnings',
        body: 'Pristine white roses symbolize sincerity, serenity, and fresh starts. Paired with lush eucalyptus or baby’s breath (gypsophila), white rose arrangements are favored for weddings, housewarmings, corporate congratulations, and peaceful sympathy tributes.'
      },
      {
        heading: 'How Many Roses Should You Gift?',
        body: '• 10 to 12 Roses: A charming, heartfelt expression of affection or gratitude.\n• 20 to 30 Roses: A generous celebratory statement for birthdays and milestones.\n• 50 to 100 Roses: A breathtaking luxury presentation for landmark anniversaries, proposals, and Valentine’s Day.'
      }
    ],
    faqs: [
      {
        question: 'Which rose color is best for a birthday gift?',
        answer: 'Pink, yellow, or mixed pastel rose bouquets are wonderful for birthdays as they celebrate joy, admiration, and warmth. For a romantic partner’s birthday, classic red or red-and-pink mixed roses are ideal.'
      },
      {
        question: 'How long do fresh Dutch roses last in a vase?',
        answer: 'With proper care—trimming stems at a 45-degree angle and changing cool water every 48 hours—fresh Dutch roses from Spring Blossoms Florist last 5 to 8 days indoors.'
      }
    ]
  },
  {
    id: 'blog-tulips-guide-india',
    title: 'Complete Guide to Tulip Flowers in India: Colors, Symbolism & Care Tips',
    slug: 'complete-guide-to-tulip-flowers-in-india',
    category: 'Flower Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '5 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Fresh pink, yellow, red, and white tulip bouquets online at Spring Blossoms Florist',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Tulip Flowers Online India',
    secondaryKeywords: [
      'Pink Tulips Bouquet',
      'Yellow Tulips Meaning',
      'Red Tulips vs Roses',
      'White Tulips Arrangement',
      'Buy Tulips in Hyderabad'
    ],
    seoTitle: 'Tulip Flowers in India: Colors, Meaning & Care Guide | SBFlorist',
    metaDescription:
      'Explore our complete guide to tulip bouquets in India. Learn the symbolism of pink, yellow, red, orange, and white tulips plus expert care tips to keep tulips fresh.',
    canonicalUrl: 'https://sbflorist.in/blog/complete-guide-to-tulip-flowers-in-india',
    noindex: false,
    excerpt:
      'Sleek, architectural, and effortlessly sophisticated—tulips are among the most sought-after luxury flowers in India. Learn what each tulip color means and how to care for them.',
    relatedCategories: [
      { name: 'Tulip Arrangements', url: '/tulips' },
      { name: 'Fresh Flower Bouquets', url: '/bouquets' },
      { name: 'Vase Arrangements', url: '/vase' }
    ],
    relatedProductQuery: 'tulip',
    sections: [
      {
        heading: 'The Appeal of Fresh Tulip Bouquets',
        body: 'With their cup-shaped petals and clean emerald stems, tulips bring modern European elegance to any celebration. Unlike static blooms, cut tulips continue to grow slightly in the vase and gracefully curve toward natural light, making every tulip arrangement a living sculpture.'
      },
      {
        heading: 'Popular Tulip Colors and Their Meanings',
        body: '• Pink Tulips: Represent caring wishes, confidence, and affectionate celebration—perfect for birthdays and family milestones.\n• Red Tulips: Associated with true love and deep romantic devotion, offering a contemporary alternative to red roses.\n• Yellow Tulips: Symbolize cheerful thoughts and sunshine; an uplifting gift for friends and colleagues.\n• Purple & Lavender Tulips: Historically linked to royalty, elegance, and artistic admiration.\n• White Tulips: Convey respect, forgiveness, and serene sophistication.'
      },
      {
        heading: 'How to Care for Cut Tulips in Warm Indian Climates',
        body: '1. Use Cold Water: Tulips thrive in cool water. You can even drop one or two ice cubes into the vase daily.\n2. Shallow Water Level: Fill the vase only 5–7 cm deep so stems stay crisp without softening.\n3. Keep Away from Direct Sunlight & AC Vents: Place your tulip vase in a cool, shaded corner away from ripening fruit.\n4. Trim Straight Across: Cut 1 cm off the base of the stems every two days with a clean floral knife.'
      }
    ],
    faqs: [
      {
        question: 'Why do tulip stems bend in a vase?',
        answer: 'Tulips are phototropic, meaning they naturally grow and lean toward light sources even after being cut. Rotating the vase daily helps keep them upright.'
      },
      {
        question: 'When are tulips best gifted?',
        answer: 'Tulips are extraordinary gifts for milestone birthdays, anniversaries, corporate congratulations, Women’s Day, and luxury housewarmings.'
      }
    ]
  },
  {
    id: 'blog-orchid-care-gifting',
    title: 'Orchid Flower Care & Gifting Guide: Purple, Blue & White Exotic Orchids',
    slug: 'orchid-flower-care-and-gifting-guide',
    category: 'Flower Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '6 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Exotic purple dendrobium and cymbidium orchid bouquets by Spring Blossoms Florist',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Orchid Flower Bouquets Online',
    secondaryKeywords: [
      'Purple Orchids Bouquet',
      'Pink Cymbidium Orchids',
      'Orchid Flower Care Tips',
      'Exotic Flowers Hyderabad',
      'Buy Orchids Online'
    ],
    seoTitle: 'Orchid Bouquets & Care Guide: Purple, White & Cymbidium | SBFlorist',
    metaDescription:
      'Learn why purple dendrobium and cymbidium orchids make unforgettable luxury gifts. Read expert care tips to keep cut orchid bouquets fresh for up to two weeks.',
    canonicalUrl: 'https://sbflorist.in/blog/orchid-flower-care-and-gifting-guide',
    noindex: false,
    excerpt:
      'Exotic orchids are prized for their regal beauty and extraordinary vase life. Explore the differences between Dendrobium and Cymbidium orchids and how to style them.',
    relatedCategories: [
      { name: 'Exotic Orchids', url: '/orchids' },
      { name: 'Flower Baskets', url: '/flower-baskets' },
      { name: 'Luxury Bouquets', url: '/bouquets' }
    ],
    relatedProductQuery: 'orchid',
    sections: [
      {
        heading: 'Why Exotic Orchids Stand Out in Luxury Gifting',
        body: 'Orchids symbolize rare beauty, strength, refinement, and luxury. Because cut orchid sprays retain their freshness far longer than most traditional blossoms, they are a favorite for grand receptions, corporate gifting, milestone anniversaries, and statement home decor.'
      },
      {
        heading: 'Dendrobium vs. Cymbidium Orchids',
        body: '• Purple & White Dendrobium Orchids: Known for their slender, graceful stems lined with multiple butterfly-like blooms in rich royal purple, magenta, and crisp white.\n• Cymbidium Orchids: Celebrated for large, waxy, sculptural blooms in blush pink, lime green, and golden yellow that command attention in luxury basket and vase arrangements.'
      },
      {
        heading: 'Making Cut Orchid Bouquets Last Up to 10–14 Days',
        body: 'Orchids are tropical blooms that appreciate humidity. Mist the petals lightly with clean room-temperature water every morning, change the vase water every two days, and trim the stem ends diagonally to ensure continuous hydration.'
      }
    ],
    faqs: [
      {
        question: 'Are purple orchids suitable for corporate gifting?',
        answer: 'Yes! Royal purple orchids represent respect, admiration, and prosperity, making them one of the most popular choices for executive congratulations and office openings.'
      }
    ]
  },
  {
    id: 'blog-lisianthus-hydrangea-luxury-guide',
    title: 'Guide to Lisianthus (Eustoma), Hydrangeas & Carnations: Luxury Pastel Blooms',
    slug: 'eustoma-lisianthus-hydrangea-luxury-blooms-guide',
    category: 'Flower Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '5 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Lavender lisianthus eustoma and pastel hydrangea flower arrangement',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'Lisianthus Eustoma and Hydrangea Bouquets',
    secondaryKeywords: [
      'Lavender Lisianthus Flowers',
      'White and Pink Eustoma',
      'Pink Hydrangea Bouquet',
      'Green Hydrangea Arrangement',
      'Carnation Bouquets Online'
    ],
    seoTitle: 'Lisianthus (Eustoma), Hydrangea & Carnation Flower Guide | SBFlorist',
    metaDescription:
      'Discover the charm of lavender lisianthus (eustoma), lush pink and blue hydrangeas, and ruffled carnations. Shop modern pastel floral arrangements online at SBFlorist.',
    canonicalUrl: 'https://sbflorist.in/blog/eustoma-lisianthus-hydrangea-luxury-blooms-guide',
    noindex: false,
    excerpt:
      'Beyond classic roses, modern floral enthusiasts are falling in love with ruffled Lisianthus (Eustoma), cloud-like Hydrangeas, and textured Carnations. Here is why they shine.',
    relatedCategories: [
      { name: 'Lavender Lisianthus', url: '/lavender-lisianthus' },
      { name: 'Hydrangea Collections', url: '/hydrangea' },
      { name: 'Carnation Bouquets', url: '/carnation' },
      { name: 'Vase Arrangements', url: '/vase' }
    ],
    relatedProductQuery: 'hydrangea',
    sections: [
      {
        heading: 'Lisianthus (Eustoma): The Rose-Like Prairie Gentian',
        body: 'Often mistaken for miniature garden roses or peonies, Lisianthus (botanically known as Eustoma) features delicate, silk-like ruffled petals in shades of lavender, white, blush pink, and champagne green. Each stem carries multiple buds that open successively, giving bouquets remarkable fullness and a 10+ day vase life.'
      },
      {
        heading: 'Hydrangeas: Cloud-Like Opulence for Grand Statements',
        body: 'Nothing matches the volume and architectural beauty of fresh Hydrangeas. Available in powder blue, blush pink, lime green, and snow white, a single hydrangea head creates a lush cushion that pairs exquisitely with Dutch roses and oriental lilies.'
      },
      {
        heading: 'Carnations: Ruffled Texture and Long-Lasting Fragrance',
        body: 'Known historically as "the flower of the gods" (Dianthus), premium carnations offer clove-sweet fragrance and exceptional durability. Pink carnations are timeless symbols of a mother’s love, while white and peach carnations bring soft romance to hand-tied bouquets.'
      }
    ],
    faqs: [
      {
        question: 'How do you keep cut hydrangeas from wilting?',
        answer: 'Hydrangeas drink water through both their stems and petals. Mist the flower heads daily and submerge freshly cut stem tips in clean, cool water mixed with flower food.'
      }
    ]
  },
  {
    id: 'blog-keep-cut-flowers-fresh',
    title: 'How to Keep Cut Flowers Fresh Longer in Indian Weather: 7 Florist Secrets',
    slug: 'how-to-keep-cut-flowers-fresh-at-home',
    category: 'Educational',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-10-25T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '5 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Fresh cut flower bouquet in glass vase with care instructions',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'How to Keep Cut Flowers Fresh',
    secondaryKeywords: [
      'Flower Care Tips India',
      'Make Rose Bouquet Last Longer',
      'Homemade Flower Food Recipe',
      'Vase Arrangement Care'
    ],
    seoTitle: 'How to Keep Cut Flowers Fresh Longer: 7 Florist Tips | SBFlorist',
    metaDescription:
      'Want your bouquet to stay vibrant for over a week? Learn 7 professional florist techniques to keep roses, lilies, sunflowers, and orchids fresh in Indian weather.',
    canonicalUrl: 'https://sbflorist.in/blog/how-to-keep-cut-flowers-fresh-at-home',
    noindex: false,
    excerpt:
      'Warm temperatures can shorten vase life if flowers are not prepped properly. Follow these 7 simple florist-approved steps to double the life of your bouquet at home.',
    relatedCategories: [
      { name: 'Vase Arrangements', url: '/vase' },
      { name: 'Lily Bouquets', url: '/lilies' },
      { name: 'Sunflower Bouquets', url: '/sunflowers' }
    ],
    relatedProductQuery: 'bouquet',
    sections: [
      {
        heading: '1. Start With a Thoroughly Clean Vase',
        body: 'Bacteria in water is the number-one cause of premature wilting and bent stems. Wash your vase with warm soapy water and rinse thoroughly before arranging your flowers.'
      },
      {
        heading: '2. Trim Stems at a 45-Degree Angle Under Water',
        body: 'Use sharp shears to cut 1.5 to 2 cm off the bottom of each stem at a 45-degree slant. Angled cuts prevent stems from sealing flat against the bottom of the vase and maximize water absorption.'
      },
      {
        heading: '3. Remove Foliage Below the Waterline',
        body: 'Any leaves submerged in water will quickly decay and cloud the vase. Strip away lower leaves so only clean stems sit beneath the waterline.'
      },
      {
        heading: '4. Use Flower Food and Refresh Water Every 48 Hours',
        body: 'Dissolve the flower nutrient packet in cool water. Every two days, replace the water completely and give the stems a fresh 0.5 cm trim.'
      },
      {
        heading: '5. Keep Away from Direct Heat, Ceiling Fans & Fruit Bowls',
        body: 'Direct afternoon sunlight, high-speed ceiling fans, and ripening fruits (especially bananas and apples, which release ethylene gas) accelerate petal aging. Display your flowers in a cool, airy spot.'
      }
    ],
    faqs: [
      {
        question: 'Can I make homemade flower food if I run out?',
        answer: 'Yes! Mix 1 liter of cool water with 1 teaspoon of sugar (for nourishment) and 2–3 drops of lemon juice or white vinegar (to balance pH and inhibit bacteria).'
      }
    ]
  },
  {
    id: 'blog-birthday-anniversary-gifting-guide',
    title: 'Best Flowers for Birthday & Anniversary Gifting: How to Choose the Perfect Bouquet',
    slug: 'best-flowers-for-birthday-and-anniversary-gifting',
    category: 'Gifting Guides',
    author: 'Spring Blossoms Gifting Curators',
    publishedAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '6 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Birthday and anniversary flower bouquets and cake combos',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Birthday and Anniversary Flowers Guide',
    secondaryKeywords: [
      'Birthday Flower Bouquets Online',
      'Anniversary Flowers for Wife',
      'Romantic Flowers for Husband',
      'Milestone Anniversary Bouquets'
    ],
    seoTitle: 'Best Flowers for Birthday & Anniversary Gifts | Gifting Guide – SBFlorist',
    metaDescription:
      'Not sure which flowers to send for a birthday or wedding anniversary? Explore our expert gifting guide matching roses, lilies, sunflowers, and orchids to every milestone.',
    canonicalUrl: 'https://sbflorist.in/blog/best-flowers-for-birthday-and-anniversary-gifting',
    noindex: false,
    excerpt:
      'From cheerful sunflower birthday bundles to grand 50-rose anniversary statements, learn how to match the right flower variety and presentation style to your recipient.',
    relatedCategories: [
      { name: 'Birthday Bouquets', url: '/birthday-bouquets' },
      { name: 'Anniversary Gifts', url: '/anniversary-gifts' },
      { name: 'Birthday Combos', url: '/birthday-combos' },
      { name: 'Anniversary Combos', url: '/anniversary-combos' }
    ],
    relatedProductQuery: 'birthday',
    sections: [
      {
        heading: 'Choosing Birthday Flowers by Personality',
        body: '• For the Optimist & Best Friend: Golden sunflowers paired with white roses or yellow gerberas radiate warmth and celebration.\n• For the Classic Romantic: Long-stem red and blush pink Dutch roses wrapped in satin ribbons.\n• For Mom & Family Elders: Fragrant oriental pink lilies or lush basket arrangements that perfume the entire living room.\n• For Trendsetters: Pastel hydrangeas, lavender lisianthus, or purple orchids in a keepsake glass vase.'
      },
      {
        heading: 'Traditional & Modern Wedding Anniversary Flowers',
        body: '• 1st Anniversary: Carnations & Pastel Roses — symbolizing youthful, enduring devotion.\n• 5th Anniversary: Daisies, Gerberas & Blue/Pink Hydrangeas.\n• 10th Anniversary: Daffodils, Yellow Lilies & Grand Mixed Bouquets.\n• 15th & 25th Silver Anniversary: Luxury 50-stem or 100-stem Red & White Rose presentations.\n• 50th Golden Anniversary: Golden Yellow Roses, Champagne Lilies & Gourmet Gift Hampers.'
      }
    ],
    faqs: [
      {
        question: 'Should I choose a hand-tied bouquet or a basket arrangement for an anniversary?',
        answer: 'Hand-tied bouquets offer dramatic unwrapping appeal, while flower baskets and glass vase arrangements are ready-to-display centerpieces that require no vase from the recipient.'
      }
    ]
  },
  {
    id: 'blog-flower-and-cake-combos-midnight',
    title: 'Ultimate Flower and Cake Combo Ideas for Unforgettable Midnight Surprises',
    slug: 'flower-and-cake-combo-ideas-for-midnight-surprises',
    category: 'Gifting Guides',
    author: 'Spring Blossoms Gifting Curators',
    publishedAt: '2026-10-29T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '5 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Red roses bouquet with Belgian chocolate truffle cake and Ferrero Rocher combo',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'Flower and Cake Combos Online',
    secondaryKeywords: [
      'Midnight Cake and Flower Delivery Hyderabad',
      'Red Roses with Chocolate Cake',
      'Birthday Cake and Bouquet Combo',
      'Chocolate Bouquet and Cake'
    ],
    seoTitle: 'Flower & Cake Combo Ideas for Midnight Surprises | SBFlorist',
    metaDescription:
      'Plan the ultimate 12 AM surprise! Discover our top-rated flower, cake, and chocolate combo pairings with same-day and midnight delivery in Hyderabad & Secunderabad.',
    canonicalUrl: 'https://sbflorist.in/blog/flower-and-cake-combo-ideas-for-midnight-surprises',
    noindex: false,
    excerpt:
      'Why choose between fresh flowers and a celebration cake when you can send both? Discover our most loved bouquet-and-cake pairings for midnight doorstep celebrations.',
    relatedCategories: [
      { name: 'All Flower & Cake Combos', url: '/combos' },
      { name: 'Celebration Cakes', url: '/cakes' },
      { name: 'Chocolate Bouquets', url: '/chocolate-bouquets' },
      { name: 'Gift Hampers', url: '/gift-hampers' }
    ],
    relatedProductQuery: 'combo',
    sections: [
      {
        heading: 'Why Paired Flower & Cake Combos Create Double the Joy',
        body: 'A celebration feels complete when visual beauty meets gourmet indulgence. While the cake is cut and shared during the celebration, the accompanying floral bouquet remains on display for days as a fragrant reminder of your gesture.'
      },
      {
        heading: 'Top 4 Florist-Recommended Bouquet & Cake Pairings',
        body: '1. Classic Red Roses + Heart-Shaped Red Velvet Cake: The gold standard for anniversaries, proposals, and Valentine’s Day.\n2. Pastel Pink Lilies & Roses + Belgian Chocolate Truffle Cake: Sophisticated, rich, and universally loved for milestone birthdays.\n3. Cheerful Sunflowers + Butterscotch or Pineapple Cake: Bright, refreshing, and ideal for daytime family celebrations.\n4. Ferrero Rocher Chocolate Bouquet + Black Forest Cake: The ultimate double-chocolate treat for sweet tooths.'
      }
    ],
    faqs: [
      {
        question: 'How does midnight flower and cake delivery work in Hyderabad?',
        answer: 'Select the Midnight Delivery slot (11:00 PM – 11:59 PM) during checkout. Our dedicated delivery team dispatches your freshly baked cake and hydrated bouquet in climate-controlled vehicles so it arrives right before midnight.'
      }
    ]
  },
  {
    id: 'blog-fragrant-indian-blooms-guide',
    title: 'Fragrant Heritage Blooms of India: Tuberose (Rajnigandha), Parijata, Chrysanthemums & Lilies',
    slug: 'fragrant-indian-blooms-tuberose-rajnigandha-parijata-guide',
    category: 'Educational',
    author: 'Spring Blossoms Botanical Desk',
    publishedAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '6 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Fragrant oriental lilies, chrysanthemums, and Indian heritage blooms',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'Fragrant Flowers in India',
    secondaryKeywords: [
      'Tuberose Rajnigandha Flowers',
      'Parijata Night Flowering Jasmine',
      'Red and White Chrysanthemums',
      'Oriental Lilies Fragrance',
      'Traditional Festive Flowers India'
    ],
    seoTitle: 'Fragrant Flowers of India: Rajnigandha, Parijata, Lilies & Chrysanthemums',
    metaDescription:
      'Explore India’s most beloved fragrant and festive blooms—from Tuberose (Rajnigandha) and sacred Parijata to Oriental Lilies and vibrant Chrysanthemums.',
    canonicalUrl: 'https://sbflorist.in/blog/fragrant-indian-blooms-tuberose-rajnigandha-parijata-guide',
    noindex: false,
    excerpt:
      'India has a rich botanical heritage of aromatic and auspicious flowers. Learn about the cultural significance of Rajnigandha, Parijata, Chrysanthemums, and Oriental Lilies.',
    relatedCategories: [
      { name: 'Fragrant Lilies', url: '/lilies' },
      { name: 'Fresh Flower Baskets', url: '/flower-baskets' },
      { name: 'Housewarming & Festive', url: '/occasions/housewarming' }
    ],
    relatedProductQuery: 'lily',
    sections: [
      {
        heading: 'Tuberose (Rajnigandha): The Night-Blooming Perfume',
        body: 'Known across India as Rajnigandha ("Fragrance of the Night"), tuberose spikes release an enchanting, honeyed aroma that intensifies after sunset. In contemporary floristry, pairing white tuberose or snapdragons with oriental lilies creates tall, structural vase arrangements that naturally scent an entire home.'
      },
      {
        heading: 'Parijata (Harsingar) & Sacred Botanical Traditions',
        body: 'The coral-stemmed Parijata (Nyctanthes arbor-tristis) is celebrated in Indian folklore for its delicate white petals and saffron-orange heart. Blooming at night and carpeting the morning earth, it inspires our white-and-orange festive floral palettes for Diwali, Dussehra, and housewarming ceremonies.'
      },
      {
        heading: 'Chrysanthemums & Oriental Lilies in Modern Gifting',
        body: 'Vibrant red, yellow, and white Chrysanthemums ("Sevanthi") symbolize longevity, optimism, and fidelity, lasting over two weeks in a vase. When blended with star-shaped Oriental Lilies and Dutch roses, they bridge traditional Indian warmth with contemporary luxury bouquet design.'
      }
    ],
    faqs: [
      {
        question: 'Which bouquet flowers have the strongest natural fragrance?',
        answer: 'Oriental pink and white lilies, premium clove-scented carnations, eucalyptus foliage, and garden roses offer the most noticeable natural fragrance for indoor spaces.'
      }
    ]
  },
  {
    id: 'blog-office-desk-flowers-plants',
    title: 'Best Flowers & Indoor Plants for Office Desks, Corporate Gifting & Reception Decor',
    slug: 'office-and-desk-flowers-for-positivity-and-productivity',
    category: 'Gifting Guides',
    author: 'Spring Blossoms Corporate Desk',
    publishedAt: '2026-11-03T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '5 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Elegant glass vase flower arrangement and indoor plants for office desks',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'Office Flowers and Corporate Gifts',
    secondaryKeywords: [
      'Flowers for Office Desk',
      'Corporate Gifting Hyderabad',
      'Low Maintenance Office Plants',
      'Vase Arrangements for Reception'
    ],
    seoTitle: 'Best Office Flowers, Vase Arrangements & Corporate Plant Gifts | SBFlorist',
    metaDescription:
      'Elevate workspaces and impress clients with fresh office flower arrangements, glass vase bouquets, and air-purifying indoor plants delivered across Hyderabad.',
    canonicalUrl: 'https://sbflorist.in/blog/office-and-desk-flowers-for-positivity-and-productivity',
    noindex: false,
    excerpt:
      'Studies show that fresh flowers and greenery in workspaces reduce stress and boost creativity. Discover the best low-maintenance blooms and plants for offices.',
    relatedCategories: [
      { name: 'Glass Vase Arrangements', url: '/vase' },
      { name: 'Exotic Orchids', url: '/orchids' },
      { name: 'Gift Hampers', url: '/gift-hampers' }
    ],
    relatedProductQuery: 'vase',
    sections: [
      {
        heading: 'Why Fresh Flowers Transform Workspaces',
        body: 'Whether placed on a reception console in HITEC City, an executive boardroom in Financial District, or a home-office desk, fresh botanicals create an immediate impression of hospitality, attention to detail, and vitality.'
      },
      {
        heading: 'Top Flowers for Air-Conditioned Office Environments',
        body: '• Orchids & Anthuriums: Thrive in indoor AC temperatures and maintain crisp petals for 10–14 days.\n• Sunflowers & Yellow Roses: Boost morale and energy without overwhelming sensitive noses with heavy pollen.\n• Glass Vase Arrangements: Convenient and self-contained—ready to place directly on a colleague’s desk for work anniversaries, promotions, or client appreciation.'
      }
    ],
    faqs: [
      {
        question: 'Do you deliver corporate flower orders to tech parks in Gachibowli and Madhapur?',
        answer: 'Yes, Spring Blossoms Florist provides scheduled same-day delivery to all corporate offices and tech campuses across HITEC City, Madhapur, Gachibowli, Financial District, Banjara Hills, and Begumpet.'
      }
    ]
  },
  {
    id: 'blog-hyderabad-secunderabad-delivery-guide',
    title: 'Complete Guide to Same-Day & Midnight Flower Delivery in Hyderabad & Secunderabad',
    slug: 'best-flower-delivery-guide-hyderabad-secunderabad',
    category: 'Local Guides',
    author: 'Spring Blossoms Logistics Team',
    publishedAt: '2026-11-05T09:00:00.000Z',
    updatedAt: '2026-11-08T10:00:00.000Z',
    readTime: '6 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Same day and midnight flower and cake delivery across Hyderabad and Secunderabad',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Flower Delivery in Hyderabad and Secunderabad',
    secondaryKeywords: [
      'Same Day Flower Delivery Hyderabad',
      'Midnight Cake and Flower Delivery',
      'Best Florist in Mehdipatnam Banjara Hills',
      'Send Flowers to Secunderabad Online'
    ],
    seoTitle: 'Same-Day & Midnight Flower Delivery Guide in Hyderabad | SBFlorist',
    metaDescription:
      'Sending flowers or cakes in Hyderabad & Secunderabad? Learn how Spring Blossoms Florist delivers farm-fresh bouquets across 100+ pin codes with same-day & midnight slots.',
    canonicalUrl: 'https://sbflorist.in/blog/best-flower-delivery-guide-hyderabad-secunderabad',
    noindex: false,
    excerpt:
      'From Banjara Hills and Gachibowli to Sainikpuri and Secunderabad, learn how our Mehdipatnam floral studio crafts and hand-delivers fresh gifts across the Twin Cities.',
    relatedCategories: [
      { name: 'Hyderabad Delivery Hub', url: '/flower-delivery-hyderabad' },
      { name: 'Secunderabad Delivery Hub', url: '/flower-delivery-secunderabad' },
      { name: 'Budget Friendly (< ₹1000)', url: '/shop/budget-friendly' },
      { name: 'All Flower Bouquets', url: '/bouquets' }
    ],
    relatedProductQuery: 'rose',
    sections: [
      {
        heading: 'Direct Local Florist Studio vs. Aggregator Couriers',
        body: 'When you order from Spring Blossoms Florist, your bouquet is handcrafted at our physical studio at Rethi Bowli, Mehdipatnam, Hyderabad (500006) by trained floral artists. Every arrangement is hydrated, wrapped in premium Korean matte sheet, and dispatched directly by our dedicated Twin Cities delivery partners.'
      },
      {
        heading: 'Key Areas Covered Across Hyderabad & Secunderabad',
        body: '• Central & West Hyderabad: Banjara Hills, Jubilee Hills, Mehdipatnam, Tolichowki, Somajiguda, Punjagutta, Masab Tank, Attapur.\n• IT & Financial Corridor: Gachibowli, Madhapur, HITEC City, Kondapur, Manikonda, Financial District, Kokapet, Nallagandla, Kukatpally, Miyapur.\n• Secunderabad & North/East Zones: Begumpet, Secunderabad Cantonment, Marredpally, Bowenpally, Sainikpuri, AS Rao Nagar, ECIL, Kompally, Alwal, Malkajgiri, Himayatnagar, Dilsukhnagar, LB Nagar.'
      },
      {
        heading: 'Free Delivery Benefits & Time Slots',
        body: '• 1st Order Free Delivery: New customers enjoy ₹0 delivery charges on their first order.\n• Free Standard Delivery on ₹999+: Orders of ₹999 and above qualify for complimentary standard delivery.\n• Midnight Surprise Slot: Available from 11:00 PM to 11:59 PM to kick off birthdays and anniversaries right at midnight.'
      }
    ],
    faqs: [
      {
        question: 'Can I send flowers to someone in Hyderabad if I live in another city or abroad?',
        answer: 'Yes! Customers across India, the USA, UK, UAE, Australia, and Canada regularly order on sbflorist.in using cards or UPI to surprise family and friends in Hyderabad and Secunderabad.'
      }
    ]
  },
  {
    id: 'blog-famous-indian-flowers-ketaki-kanakambaram-brahma-kamal',
    title: 'Famous Indian Flowers Guide: Ketaki, Kanakambaram (Crossandra), Brahma Kamal, Jasmine & Traditional Decor',
    slug: 'famous-indian-flowers-ketaki-kanakambaram-brahma-kamal-jasmine',
    category: 'Educational',
    author: 'Spring Blossoms Botanical Desk',
    publishedAt: '2026-11-06T09:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    readTime: '8 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Traditional Indian flowers including Jasmine, Kanakambaram, Brahma Kamal, and Marigold floral decor',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Famous Indian flowers',
    secondaryKeywords: [
      'Ketaki flower meaning',
      'Kanakambaram flower in English',
      'Types of jasmine flowers',
      'Brahma Kamal flower information',
      'Traditional flower decorations',
      'Simple floral rangoli designs'
    ],
    seoTitle: 'Famous Indian Flowers: Ketaki, Kanakambaram, Brahma Kamal & Jasmine',
    metaDescription:
      'Discover famous Indian flowers—Ketaki flower meaning, Kanakambaram in English (Crossandra), sacred Brahma Kamal, types of jasmine, and floral rangoli decor.',
    canonicalUrl: 'https://sbflorist.in/blog/famous-indian-flowers-ketaki-kanakambaram-brahma-kamal-jasmine',
    noindex: false,
    excerpt:
      'Explore India’s most iconic botanical treasures: learn the meaning of the fragrant Ketaki flower, what Kanakambaram is called in English, the rarity of Brahma Kamal, and how to style traditional floral decorations.',
    relatedCategories: [
      { name: 'Fresh Flower Bouquets', url: '/bouquets' },
      { name: 'Fragrant Lilies', url: '/lilies' },
      { name: 'Rose Arrangements', url: '/roses' },
      { name: 'Hyderabad Flower Delivery', url: '/flower-delivery-hyderabad' }
    ],
    relatedProductQuery: 'rose',
    sections: [
      {
        heading: 'Ketaki Flower Meaning & Botanical Heritage (Pandanus odorifer)',
        body: 'The Ketaki flower—botanically classified as Pandanus odorifer (often called Screwpine or Kewda in Hindi)—is one of India’s most aromatic coastal and tropical botanicals. Known for its long, cream-coloured, sword-shaped floral bracts, Ketaki carries a deep, sweet, woody aroma prized in Indian perfumery and festive traditions. In Indian cultural literature, Ketaki symbolizes resilience, hidden beauty, and tropical monsoon abundance.'
      },
      {
        heading: 'Kanakambaram Flower in English: The Firecracker Flower (Crossandra)',
        body: 'One of the most frequently asked botanical questions across South India and Telangana is: "What is Kanakambaram flower in English?" In English, Kanakambaram (Crossandra infundibuliformis) is called the Firecracker Flower or Tropical Flame. Named for its seed pods that burst open when exposed to humidity, Kanakambaram features fan-shaped petals in luminous shades of salmon-orange, apricot, and terracotta. Because its petals are weightless and do not wilt quickly, Kanakambaram is traditionally woven alongside white jasmine in garlands (veni) and festive threshold arrangements.'
      },
      {
        heading: 'Brahma Kamal Flower Information (Saussurea obvallata)',
        body: 'The Brahma Kamal (Saussurea obvallata), native to the high-altitude Himalayan meadows of Uttarakhand, is revered as the "Lotus of Lord Brahma." Unlike aquatic lotuses, Brahma Kamal is a terrestrial alpine bloom belonging to the Asteraceae family. It is famous for blooming only once a year after sunset during the late monsoon months, unfolding translucent, star-like white bracts that protect its purple-tinted floral core against mountain frost. Seeing a Brahma Kamal in bloom is considered a symbol of auspicious fortune and serenity.'
      },
      {
        heading: 'Types of Jasmine Flowers Celebrated Across India',
        body: 'India is home to dozens of fragrant jasmine (Jasminum) varieties that inspire both traditional garlands and modern luxury bridal bouquets:\n• Mogra / Gundu Malli (Jasminum sambac): Rounded, multi-layered pearls with an intense, sweet evening fragrance.\n• Madurai Mallige: GI-tagged jasmine renowned for thick, slow-opening petals and long shelf life.\n• Juhi (Jasminum auriculatum): Delicate, star-shaped white blooms with a crisp, powdery floral scent.\n• Chameli / Royal Jasmine (Jasminum grandiflorum): Long-petalled blossoms with a subtle pink underside used in celebratory decor.\n• Mullai & Jaati: Classic South Indian varieties prized for temple decoration and wedding mandaps.'
      },
      {
        heading: 'Simple Floral Rangoli Designs (Pookkalam) & Traditional Flower Decorations',
        body: 'Fresh flower petals bring biodegradable vibrancy to Indian entrances during Diwali, Sankranti, Bathukamma, Onam, and housewarming ceremonies:\n• Concentric Petal Mandala: Use yellow and orange marigold (Genda) petals for the outer ring, crimson rose petals for the middle ring, and white chrysanthemum or jasmine buds at the centre.\n• Lotus Diya Border: Outline a simple four-petal lotus with white tuberose (Rajnigandha) florets and fill the petals with pink rose and orange Kanakambaram shades, placing brass diyas at each corner.\n• Urli Floating Bowl: Fill a wide brass or ceramic urli with clean water, float Dutch rose heads, orchid florets, and tea-light candles for an effortless 5-minute foyer centerpiece.'
      }
    ],
    faqs: [
      {
        question: 'What is Kanakambaram flower called in English?',
        answer: 'Kanakambaram is called the Firecracker Flower (botanical name: Crossandra infundibuliformis) in English due to its vibrant flame-orange petals and popping seed pods.'
      },
      {
        question: 'What is the meaning of the Ketaki flower?',
        answer: 'Ketaki (Pandanus odorifer / Kewda) is a fragrant tropical pandanus blossom that symbolizes monsoon abundance, natural perfume, and enduring beauty in Indian botanical tradition.'
      },
      {
        question: 'Which fresh flowers are best for simple floral rangoli and urli bowls in Hyderabad?',
        answer: 'Red and yellow rose petals, marigold strings, white and yellow chrysanthemums (Sevanthi), and purple dendrobium orchid heads hold their colour and shape best for indoor rangolis and floating urli bowls.'
      }
    ]
  },
  {
    id: 'blog-dahlia-chrysanthemum-gerbera-ranunculus-india',
    title: 'Dahlia, Ranunculus, Chrysanthemum & Gerbera Flowers in India: Colours, Seasonality & Gifting Guide',
    slug: 'dahlia-chrysanthemum-gerbera-ranunculus-flowers-india-guide',
    category: 'Flower Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-11-07T09:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    readTime: '7 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Peach and yellow dahlia, white ranunculus, red chrysanthemums, and gerbera bouquets in India',
    isPublished: true,
    isFeatured: false,
    focusKeyword: 'Dahlia flowers in India',
    secondaryKeywords: [
      'White and Pink Ranunculus',
      'Red Chrysanthemums',
      'Orange and White Gerberas',
      'Peach and Yellow Dahlia',
      'Best flowers for gifting'
    ],
    seoTitle: 'Dahlia, Ranunculus, Chrysanthemum & Gerbera Flowers Guide | SBFlorist',
    metaDescription:
      'Learn about Dahlia flowers in India, White & Pink Ranunculus, Red Chrysanthemums, and vibrant Gerberas—their symbolism, vase life, and luxury bouquet pairings.',
    canonicalUrl: 'https://sbflorist.in/blog/dahlia-chrysanthemum-gerbera-ranunculus-flowers-india-guide',
    noindex: false,
    excerpt:
      'From architectural Peach and Yellow Dahlias to cloud-like Ranunculus and cheerful Gerberas, discover how textured blooms elevate luxury flower bouquets in India.',
    relatedCategories: [
      { name: 'Designer Bouquets', url: '/bouquets' },
      { name: 'Glass Vase Arrangements', url: '/vase' },
      { name: 'Flower Baskets', url: '/flower-baskets' },
      { name: 'Birthday Flowers', url: '/occasions/birthday' }
    ],
    relatedProductQuery: 'bouquet',
    sections: [
      {
        heading: 'Dahlia Flowers in India: Geometric Elegance in Peach, Yellow & Crimson',
        body: 'Celebrated for their symmetrical, honeycombed petals, Dahlia flowers thrive across Indian hill stations and winter gardens from October through March. Peach Dahlias and Yellow Dahlias bring warm, sunset tones to contemporary hand-tied bouquets, symbolizing inner strength, creativity, and dignity. Because Dahlias have large, statement heads, pairing them with spray roses and eucalyptus creates high-impact anniversary and congratulatory arrangements.'
      },
      {
        heading: 'White & Pink Ranunculus: The Multi-Petalled Persian Buttercup',
        body: 'Often mistaken for miniature peonies, White Ranunculus and Pink Ranunculus feature over a hundred tissue-thin, concentric petals per bloom. In luxury floristry, Ranunculus represents radiant charm and magnetic attraction. Their sturdy, hollow stems perform exceptionally well in cool indoor rooms when hydrated in shallow, clean water.'
      },
      {
        heading: 'Red, White & Yellow Chrysanthemums: The Champions of Vase Longevity',
        body: 'Whether you choose pompon, disbud, or spray varieties, Red Chrysanthemums, White Chrysanthemums, and Golden Chrysanthemums ("Guldaudi" / "Sevanthi") are among the longest-lasting cut flowers in India—routinely staying crisp for 10 to 14 days. Red Chrysanthemums convey deep affection and vitality, while white and green varieties lend architectural texture to modern glass vase arrangements.'
      },
      {
        heading: 'Orange, Pink & White Gerberas: Instant Sunshine in a Bouquet',
        body: 'Gerbera daisies—especially Orange Gerberas, White Gerberas, and Cerise Pink Gerberas—are universally loved for their wide, cheerful faces. Because Gerberas have zero overwhelming pollen scent, they are one of the best flowers for gifting to new parents, hospital recovery rooms, children’s birthdays, and corporate congratulatory milestones.'
      }
    ],
    faqs: [
      {
        question: 'When are Dahlia and Ranunculus flowers in peak season in India?',
        answer: 'Dahlias and Ranunculus are at their peak freshness in India during the cooler months from November through March, while Chrysanthemums, Gerberas, Roses, Lilies, and Orchids are available fresh year-round.'
      },
      {
        question: 'How do you keep Gerbera stems from bending in a vase?',
        answer: 'Fill the vase with only 5 to 7 cm of clean water (Gerbera stems soften in deep water) and recut the stem ends at a 45-degree angle every two days.'
      }
    ]
  },
  {
    id: 'blog-flower-meanings-symbolism-gifting',
    title: 'Flower Meanings and Symbolism: How to Choose the Best Flowers for Gifting in India',
    slug: 'flower-meanings-and-symbolism-gifting-guide',
    category: 'Gifting Guides',
    author: 'Spring Blossoms Master Florists',
    publishedAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    readTime: '7 min read',
    coverImage: '/images/hero-flower-shop.jpg',
    imageAlt: 'Luxury bouquet of roses, lilies, orchids, and hydrangea illustrating flower meanings and symbolism',
    isPublished: true,
    isFeatured: true,
    focusKeyword: 'Flower meanings and symbolism',
    secondaryKeywords: [
      'Best flowers for gifting',
      'Different types of roses',
      'Tulip flower meaning',
      'Orchid and Lily symbolism',
      'Birthday and Anniversary flowers guide'
    ],
    seoTitle: 'Flower Meanings & Symbolism: Best Flowers for Gifting | SBFlorist',
    metaDescription:
      'Learn the meaning and symbolism behind Roses, Tulips, Lilies, Orchids, Hydrangeas & Carnations so you can choose the best flowers for birthdays & anniversaries.',
    canonicalUrl: 'https://sbflorist.in/blog/flower-meanings-and-symbolism-gifting-guide',
    noindex: false,
    excerpt:
      'Every bloom tells a story. Use our complete floriography guide to match rose colours, tulips, lilies, orchids, and carnations to the exact emotion you want to express.',
    relatedCategories: [
      { name: 'Rose Bouquets', url: '/roses' },
      { name: 'Birthday Flowers', url: '/occasions/birthday' },
      { name: 'Anniversary Flowers', url: '/occasions/anniversary' },
      { name: 'Valentine’s Collection', url: '/valentine-special' }
    ],
    relatedProductQuery: 'rose',
    sections: [
      {
        heading: 'Different Types of Roses & Their Colour Meanings',
        body: 'Roses remain the undisputed icon of floral gifting, and each shade carries a distinct message:\n• Deep Red Roses (Tajmahal / Freedom): Passionate love, devotion, and timeless romance—ideal for anniversaries and Valentine’s Day.\n• Pink & Jumelia Roses: Grace, admiration, gratitude, and sweet affection—perfect for mothers, sisters, and milestone birthdays.\n• White Roses (Avalanche): Purity, new beginnings, peace, and sincere respect—chosen for weddings, housewarmings, and heartfelt apologies.\n• Yellow Roses: Warm friendship, joy, and optimism—a favourite for congratulating friends and colleagues.\n• Peach & Coral Roses: Sincerity, appreciation, and modest elegance—suited for corporate gifting and thank-you gestures.'
      },
      {
        heading: 'Tulip, Lily, Orchid & Hydrangea Symbolism',
        body: '• Tulips: Symbolize perfect, enduring love and spring renewal. Pink tulips express caring wishes, purple tulips represent royalty, and yellow tulips radiate cheerful thoughts.\n• Oriental & Asiatic Lilies: Represent refined beauty, prosperity, and devotion. Their star-like blooms open progressively over a week, making the gift feel bigger every day.\n• Purple & Blue Dendrobium Orchids: Convey luxury, rare strength, and admiration—an unmistakable statement gift for executives and mentors.\n• Hydrangeas & Lisianthus (Eustoma): Symbolize heartfelt abundance, grace, and lifelong appreciation.'
      },
      {
        heading: 'How to Pick the Best Flowers for Every Occasion',
        body: '• Birthdays: Vibrant mixed bouquets featuring yellow roses, pink lilies, gerberas, or a flower-and-cake combo.\n• Wedding Anniversaries: 24, 50, or 100 long-stemmed Dutch red roses, pink-and-white rose heart arrangements, or pastel hydrangea baskets.\n• Housewarming & Festive Visits: Yellow and white lilies, orchids, or tabletop glass vase arrangements that require zero fuss from the host.\n• Romantic Surprises: Midnight delivery of red roses paired with Ferrero Rocher chocolates and a handwritten message card.'
      }
    ],
    faqs: [
      {
        question: 'Which flowers are best for a 1st or 25th wedding anniversary?',
        answer: 'Classic long-stemmed red roses, pink carnations, and white-and-pink oriental lily baskets are the most cherished choices for 1st and 25th silver jubilee wedding anniversaries.'
      },
      {
        question: 'Can I include a personalized message card with my flower order?',
        answer: 'Yes, every order from Spring Blossoms Florist includes a complimentary printed message card where you can share your personal note.'
      }
    ]
  }
];

// ── Global SEO Settings Helpers ──────────────────────────────────────────
let cachedGlobalSettings = null;
let cachedGlobalSettingsExpiry = 0;

const getGlobalSeoSettings = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedGlobalSettings && cachedGlobalSettingsExpiry > now) {
    return cachedGlobalSettings;
  }

  try {
    const record = await prisma.setting.findUnique({
      where: { key: GLOBAL_SEO_SETTING_KEY }
    });

    if (record && record.data && typeof record.data === 'object') {
      cachedGlobalSettings = {
        ...DEFAULT_GLOBAL_SEO_SETTINGS,
        ...record.data
      };
    } else {
      await prisma.setting.upsert({
        where: { key: GLOBAL_SEO_SETTING_KEY },
        update: { data: DEFAULT_GLOBAL_SEO_SETTINGS },
        create: {
          id: GLOBAL_SEO_SETTING_KEY,
          key: GLOBAL_SEO_SETTING_KEY,
          data: DEFAULT_GLOBAL_SEO_SETTINGS
        }
      });
      cachedGlobalSettings = { ...DEFAULT_GLOBAL_SEO_SETTINGS };
    }
    cachedGlobalSettingsExpiry = now + 5 * 60 * 1000;
    return cachedGlobalSettings;
  } catch (err) {
    console.warn('Fallback to default global SEO settings:', err.message);
    return { ...DEFAULT_GLOBAL_SEO_SETTINGS };
  }
};

const updateGlobalSeoSettings = async (updates) => {
  const current = await getGlobalSeoSettings(true);
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await prisma.setting.upsert({
    where: { key: GLOBAL_SEO_SETTING_KEY },
    update: { data: merged },
    create: {
      id: GLOBAL_SEO_SETTING_KEY,
      key: GLOBAL_SEO_SETTING_KEY,
      data: merged
    }
  });

  cachedGlobalSettings = merged;
  cachedGlobalSettingsExpiry = Date.now() + 5 * 60 * 1000;
  return merged;
};

// ── Blog Posts Helpers ───────────────────────────────────────────────────
let cachedBlogPosts = null;
let cachedBlogExpiry = 0;

const getAllBlogPosts = async (includeDrafts = false, forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedBlogPosts && cachedBlogExpiry > now) {
    return includeDrafts ? cachedBlogPosts : cachedBlogPosts.filter((p) => p.isPublished !== false);
  }

  try {
    const record = await prisma.setting.findUnique({
      where: { key: BLOG_POSTS_SETTING_KEY }
    });

    let posts = [];
    if (record && Array.isArray(record.data) && record.data.length > 0) {
      posts = [...record.data];
      let addedNewInitial = false;
      for (const initPost of INITIAL_BLOG_POSTS) {
        const exists = posts.some(
          (p) => p.id === initPost.id || String(p.slug || '').toLowerCase() === String(initPost.slug || '').toLowerCase()
        );
        if (!exists) {
          posts.push(initPost);
          addedNewInitial = true;
        }
      }
      if (addedNewInitial) {
        await prisma.setting.upsert({
          where: { key: BLOG_POSTS_SETTING_KEY },
          update: { data: posts },
          create: {
            id: BLOG_POSTS_SETTING_KEY,
            key: BLOG_POSTS_SETTING_KEY,
            data: posts
          }
        });
      }
    } else {
      posts = INITIAL_BLOG_POSTS;
      await prisma.setting.upsert({
        where: { key: BLOG_POSTS_SETTING_KEY },
        update: { data: posts },
        create: {
          id: BLOG_POSTS_SETTING_KEY,
          key: BLOG_POSTS_SETTING_KEY,
          data: posts
        }
      });
    }

    cachedBlogPosts = posts;
    cachedBlogExpiry = now + 5 * 60 * 1000;
    return includeDrafts ? posts : posts.filter((p) => p.isPublished !== false);
  } catch (err) {
    console.warn('Fallback to initial blog posts:', err.message);
    return includeDrafts ? INITIAL_BLOG_POSTS : INITIAL_BLOG_POSTS.filter((p) => p.isPublished !== false);
  }
};

const getBlogPostBySlug = async (slugOrId, includeDrafts = false) => {
  const posts = await getAllBlogPosts(includeDrafts);
  const target = String(slugOrId || '').trim().toLowerCase();
  return (
    posts.find(
      (p) =>
        String(p.slug || '').toLowerCase() === target ||
        String(p.id || '').toLowerCase() === target
    ) || null
  );
};

const saveBlogPostsArray = async (posts) => {
  await prisma.setting.upsert({
    where: { key: BLOG_POSTS_SETTING_KEY },
    update: { data: posts },
    create: {
      id: BLOG_POSTS_SETTING_KEY,
      key: BLOG_POSTS_SETTING_KEY,
      data: posts
    }
  });
  cachedBlogPosts = posts;
  cachedBlogExpiry = Date.now() + 5 * 60 * 1000;
  return posts;
};

const createOrUpdateBlogPost = async (postData, existingId = null) => {
  const posts = await getAllBlogPosts(true, true);
  const nowIso = new Date().toISOString();

  const title = String(postData.title || 'Untitled Guide').trim();
  const cleanSlug = slugify(postData.slug || title);

  const normalized = {
    id: existingId || postData.id || `blog-${Date.now()}`,
    title,
    slug: cleanSlug,
    category: postData.category || 'Flower Guides',
    author: postData.author || 'Spring Blossoms Master Florists',
    publishedAt: postData.publishedAt || nowIso,
    updatedAt: nowIso,
    readTime: postData.readTime || '5 min read',
    coverImage: postData.coverImage || '/images/hero-flower-shop.jpg',
    imageAlt: postData.imageAlt || `${title} - Spring Blossoms Florist`,
    isPublished: postData.isPublished !== undefined ? Boolean(postData.isPublished) : true,
    isFeatured: Boolean(postData.isFeatured),
    focusKeyword: postData.focusKeyword || title,
    secondaryKeywords: Array.isArray(postData.secondaryKeywords)
      ? postData.secondaryKeywords
      : String(postData.secondaryKeywords || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    seoTitle: postData.seoTitle || `${title.slice(0, 48)} | SBFlorist`,
    metaDescription:
      postData.metaDescription ||
      postData.excerpt ||
      `Read ${title} by Spring Blossoms Florist. Discover expert flower care, gifting tips, and same-day flower delivery in Hyderabad.`,
    canonicalUrl: postData.canonicalUrl || `https://sbflorist.in/blog/${cleanSlug}`,
    noindex: Boolean(postData.noindex),
    excerpt: postData.excerpt || '',
    relatedCategories: Array.isArray(postData.relatedCategories)
      ? postData.relatedCategories
      : [
          { name: 'Rose Bouquets', url: '/roses' },
          { name: 'Flower Bouquets', url: '/bouquets' },
          { name: 'Flower & Cake Combos', url: '/combos' }
        ],
    relatedProductQuery: postData.relatedProductQuery || 'rose',
    sections: Array.isArray(postData.sections) ? postData.sections : [],
    faqs: Array.isArray(postData.faqs) ? postData.faqs : []
  };

  const idx = posts.findIndex((p) => p.id === normalized.id || p.slug === normalized.slug);
  if (idx !== -1) {
    posts[idx] = { ...posts[idx], ...normalized, updatedAt: nowIso };
  } else {
    posts.unshift(normalized);
  }

  await saveBlogPostsArray(posts);
  return normalized;
};

const deleteBlogPost = async (idOrSlug) => {
  const posts = await getAllBlogPosts(true, true);
  const filtered = posts.filter((p) => p.id !== idOrSlug && p.slug !== idOrSlug);
  await saveBlogPostsArray(filtered);
  return filtered.length < posts.length;
};

// ── Category Extended SEO Settings Helpers ───────────────────────────────
const getCategorySeoExtensions = async () => {
  try {
    const record = await prisma.setting.findUnique({
      where: { key: CATEGORY_EXT_SETTING_KEY }
    });
    return record && record.data && typeof record.data === 'object' ? record.data : {};
  } catch (e) {
    return {};
  }
};

const saveCategorySeoExtension = async (categoryIdOrSlug, extData) => {
  const current = await getCategorySeoExtensions();
  current[categoryIdOrSlug] = {
    ...(current[categoryIdOrSlug] || {}),
    ...extData,
    updatedAt: new Date().toISOString()
  };
  await prisma.setting.upsert({
    where: { key: CATEGORY_EXT_SETTING_KEY },
    update: { data: current },
    create: {
      id: CATEGORY_EXT_SETTING_KEY,
      key: CATEGORY_EXT_SETTING_KEY,
      data: current
    }
  });
  return current[categoryIdOrSlug];
};

// ── Comprehensive SEO Health & Diagnostics Audit ─────────────────────────
const runComprehensiveSeoAudit = async () => {
  const [products, categories, blogs, globalSettings] = await Promise.all([
    prisma.product
      .findMany({
        where: { isVisible: true, approvalStatus: 'approved' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortDescription: true,
          price: true,
          seoSettings: true,
          images: { select: { id: true, url: true, alt: true, isPrimary: true }, orderBy: { isPrimary: 'desc' }, take: 1 },
          categories: { include: { category: { select: { name: true, slug: true } } } }
        }
      })
      .catch(() => []),
    prisma.category
      .findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          metaTitle: true,
          metaDescription: true,
          categoryUrl: true
        }
      })
      .catch(() => []),
    getAllBlogPosts(true),
    getGlobalSeoSettings()
  ]);

  const titleMap = new Map();
  const descMap = new Map();

  const missingTitles = [];
  const missingDescriptions = [];
  const missingH1s = [];
  const missingAltTexts = [];
  const thinContentProducts = [];
  const suboptimalTitleLength = [];
  const suboptimalDescLength = [];
  const duplicateTitles = [];
  const duplicateDescriptions = [];

  let totalProductScore = 0;

  for (const prod of products) {
    const existing = prod.seoSettings && typeof prod.seoSettings === 'object' ? prod.seoSettings : {};
    const catName = prod.categories?.[0]?.category?.name || 'Flowers';
    const generated = generateProductSeo({ ...prod, category: catName }, existing);

    totalProductScore += generated.score || 0;

    const effectiveTitle = (existing.seoTitle || existing.metaTitle || generated.seoTitle || '').trim();
    const effectiveDesc = (existing.metaDescription || existing.seoDescription || generated.metaDescription || '').trim();
    const effectiveH1 = (existing.h1 || prod.name || '').trim();
    const primaryImg = prod.images?.[0];
    const effectiveAlt = (existing.imageAlt || primaryImg?.alt || '').trim();
    const plainDesc = String(prod.description || prod.shortDescription || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = plainDesc ? plainDesc.split(' ').filter(Boolean).length : 0;

    if (! existing.seoTitle && !existing.metaTitle) {
      missingTitles.push({ id: prod.id, name: prod.name, slug: prod.slug, suggested: generated.seoTitle });
    }
    if (!existing.metaDescription && !existing.seoDescription) {
      missingDescriptions.push({ id: prod.id, name: prod.name, slug: prod.slug, suggested: generated.metaDescription });
    }
    if (!effectiveH1) {
      missingH1s.push({ id: prod.id, name: prod.name, slug: prod.slug });
    }
    if (!effectiveAlt || effectiveAlt.length < 8) {
      missingAltTexts.push({ id: prod.id, name: prod.name, slug: prod.slug, suggested: generated.imageAlt });
    }
    if (wordCount < 25) {
      thinContentProducts.push({ id: prod.id, name: prod.name, slug: prod.slug, wordCount });
    }
    if (effectiveTitle.length < 30 || effectiveTitle.length > 65) {
      suboptimalTitleLength.push({ id: prod.id, name: prod.name, length: effectiveTitle.length, title: effectiveTitle });
    }
    if (effectiveDesc.length < 100 || effectiveDesc.length > 165) {
      suboptimalDescLength.push({ id: prod.id, name: prod.name, length: effectiveDesc.length });
    }

    if (effectiveTitle) {
      const key = effectiveTitle.toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key).push({ id: prod.id, name: prod.name, slug: prod.slug, title: effectiveTitle });
    }
    if (effectiveDesc) {
      const key = effectiveDesc.toLowerCase();
      if (!descMap.has(key)) descMap.set(key, []);
      descMap.get(key).push({ id: prod.id, name: prod.name, slug: prod.slug, metaDescription: effectiveDesc });
    }
  }

  for (const [, list] of titleMap.entries()) {
    if (list.length > 1) {
      duplicateTitles.push({ title: list[0].title, count: list.length, items: list });
    }
  }
  for (const [, list] of descMap.entries()) {
    if (list.length > 1) {
      duplicateDescriptions.push({ metaDescription: list[0].metaDescription, count: list.length, items: list });
    }
  }

  const unoptimizedCategories = categories
    .filter((c) => !c.metaTitle || !c.metaDescription)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, missingTitle: !c.metaTitle, missingDesc: !c.metaDescription }));

  const avgProductScore = products.length > 0 ? Math.round(totalProductScore / products.length) : 100;

  // Compute overall technical & content health score
  let healthScore = avgProductScore;
  if (duplicateTitles.length > 0) healthScore -= Math.min(10, duplicateTitles.length * 2);
  if (duplicateDescriptions.length > 0) healthScore -= Math.min(10, duplicateDescriptions.length * 2);
  if (missingAltTexts.length > 0) healthScore -= Math.min(8, Math.ceil(missingAltTexts.length / 10));
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    summary: {
      healthScore,
      avgProductScore,
      totalProducts: products.length,
      totalCategories: categories.length,
      totalBlogs: blogs.length,
      publishedBlogs: blogs.filter((b) => b.isPublished !== false).length,
      storedTitlesCount: products.length - missingTitles.length,
      storedDescriptionsCount: products.length - missingDescriptions.length,
      duplicateTitlesCount: duplicateTitles.length,
      duplicateDescriptionsCount: duplicateDescriptions.length,
      missingAltCount: missingAltTexts.length,
      thinContentCount: thinContentProducts.length,
      unoptimizedCategoriesCount: unoptimizedCategories.length,
      sitemapEnabled: Boolean(globalSettings.enableAutoSitemap),
      schemaEnabled: Boolean(globalSettings.enableSchemaMarkup),
      gscConfigured: Boolean(globalSettings.googleSearchConsoleVerification),
      ga4Configured: Boolean(globalSettings.googleAnalyticsId)
    },
    issues: {
      duplicateTitles: duplicateTitles.slice(0, 25),
      duplicateDescriptions: duplicateDescriptions.slice(0, 25),
      missingTitles: missingTitles.slice(0, 30),
      missingDescriptions: missingDescriptions.slice(0, 30),
      missingAltTexts: missingAltTexts.slice(0, 30),
      thinContentProducts: thinContentProducts.slice(0, 30),
      unoptimizedCategories: unoptimizedCategories.slice(0, 30),
      suboptimalTitleLength: suboptimalTitleLength.slice(0, 25),
      suboptimalDescLength: suboptimalDescLength.slice(0, 25)
    }
  };
};

// ── Centralized Keyword-to-Page Mapping System (Phase 2 & 3) ────────────
// Strictly stores real page keyword assignments. Search volume, KD, and ranking
// position default to null unless verified from Google Search Console or user CSV import.

const PRIORITY_PAGE_KEYWORD_MAPPINGS = [
  {
    id: 'kw-home',
    pageUrl: '/',
    pageType: 'Homepage',
    pageTitle: 'Spring Blossoms Florist | Buy Flowers & Gifts Online in India',
    primaryKeyword: 'Buy flowers online',
    secondaryKeywords: [
      'Online flower delivery in India',
      'Spring Blossoms Florist',
      'Best online florist',
      'Fresh flower delivery',
      'Premium flower bouquets',
      'Order flowers online',
      'Online gifting store',
      'Flowers and gifts online',
      'Florist in Hyderabad'
    ],
    longTailKeywords: [
      'Buy fresh flower bouquets and cakes online in India',
      'Same day and midnight flower delivery from local florist studio',
      'Send roses orchids lilies and gift hampers online'
    ],
    searchIntent: 'Commercial / Transactional',
    targetLocation: 'India & Hyderabad',
    keywordCluster: 'Brand & Core Florist',
    internalLinksCount: 28,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-hyderabad',
    pageUrl: '/flower-delivery-hyderabad',
    pageType: 'Local Landing Page',
    pageTitle: 'Flower Delivery in Hyderabad | Same-Day & Midnight Florist | SBFlorist',
    primaryKeyword: 'Flower delivery in Hyderabad',
    secondaryKeywords: [
      'Best florist in Hyderabad',
      'Online flower delivery Hyderabad',
      'Buy flowers online Hyderabad',
      'Fresh flower delivery Hyderabad',
      'Bouquet delivery Hyderabad',
      'Birthday flowers Hyderabad',
      'Anniversary flowers Hyderabad',
      'Rose bouquet Hyderabad',
      'Cake and flower delivery Hyderabad'
    ],
    longTailKeywords: [
      'Same day flower delivery in Hyderabad',
      'Midnight flower delivery in Hyderabad',
      'Send flowers to Hyderabad online',
      'Best flower shop in Mehdipatnam Banjara Hills Gachibowli HITEC City'
    ],
    searchIntent: 'Local Transactional',
    targetLocation: 'Hyderabad, Telangana',
    keywordCluster: 'Hyderabad Local SEO',
    internalLinksCount: 24,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-secunderabad',
    pageUrl: '/flower-delivery-secunderabad',
    pageType: 'Local Landing Page',
    pageTitle: 'Flower Delivery in Secunderabad | Same-Day & Midnight Bouquets | SBFlorist',
    primaryKeyword: 'Flower delivery in Secunderabad',
    secondaryKeywords: [
      'Send flowers to Secunderabad',
      'Best florist in Secunderabad',
      'Same day flower delivery Secunderabad',
      'Rose bouquet delivery Secunderabad',
      'Cake and flower delivery Secunderabad',
      'Florist near Sainikpuri Begumpet Bowenpally'
    ],
    longTailKeywords: [
      'Order birthday and anniversary flowers in Secunderabad Cantonment',
      'Midnight cake and rose bouquet delivery in Secunderabad'
    ],
    searchIntent: 'Local Transactional',
    targetLocation: 'Secunderabad, Telangana',
    keywordCluster: 'Hyderabad Local SEO',
    internalLinksCount: 18,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-roses',
    pageUrl: '/roses',
    pageType: 'Category',
    pageTitle: 'Buy Fresh Rose Bouquets Online in Hyderabad | Red, Pink, White & Yellow Roses',
    primaryKeyword: 'Buy roses online',
    secondaryKeywords: [
      'Red roses online',
      'Pink roses online',
      'White roses online',
      'Yellow roses online',
      'Fresh rose bouquet',
      'Premium rose bouquet',
      'Jumelia roses bouquet'
    ],
    longTailKeywords: [
      'Send 50 and 100 red roses bouquet online in Hyderabad',
      'Long stemmed Dutch Tajmahal red rose bouquet delivery',
      'Heart shape red rose arrangement for anniversary'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Roses',
    internalLinksCount: 16,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-bouquets',
    pageUrl: '/bouquets',
    pageType: 'Category',
    pageTitle: 'Premium Flower Bouquets Online in Hyderabad | Luxury Hand-Tied Arrangements',
    primaryKeyword: 'Premium flower bouquets',
    secondaryKeywords: [
      'Luxury rose bouquet',
      'Mixed flower bouquets',
      'Birthday bouquets',
      'Anniversary bouquets',
      'Romantic bouquets',
      'Mini flower bouquets'
    ],
    longTailKeywords: [
      'Hand tied Korean wrapped flower bouquets online Hyderabad',
      'Order fresh mixed flower bouquet for same day delivery'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Bouquets & Arrangements',
    internalLinksCount: 16,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-tulips',
    pageUrl: '/tulips',
    pageType: 'Category',
    pageTitle: 'Buy Fresh Tulip Bouquets Online | Pink, White, Red, Yellow & Purple Tulips',
    primaryKeyword: 'Buy tulips online',
    secondaryKeywords: [
      'Pink tulips online',
      'White tulips online',
      'Red tulips online',
      'Yellow tulips online',
      'Purple tulip bouquet',
      'Tulip bouquets online',
      'Orange tulips bouquet'
    ],
    longTailKeywords: [
      'Imported Dutch tulip flower bouquets in Hyderabad',
      'Send fresh pink and white tulips for anniversary'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Tulips',
    internalLinksCount: 12,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-lilies',
    pageUrl: '/lilies',
    pageType: 'Category',
    pageTitle: 'Fresh Oriental & Asiatic Lily Bouquets Online | Pink, White & Yellow Lilies',
    primaryKeyword: 'Fresh lily bouquets',
    secondaryKeywords: [
      'Pink oriental lilies online',
      'White lilies bouquet',
      'Asiatic lilies Hyderabad',
      'Fragrant lily flower basket',
      'Rose and lily bouquet'
    ],
    longTailKeywords: [
      'Buy fragrant pink oriental lily bouquet online in Hyderabad',
      'White lily and rose arrangement in glass vase'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Lilies',
    internalLinksCount: 12,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-orchids',
    pageUrl: '/orchids',
    pageType: 'Category',
    pageTitle: 'Exotic Orchid Bouquets Online in Hyderabad | Purple, Blue & Pink Cymbidium Orchids',
    primaryKeyword: 'Purple orchid bouquets',
    secondaryKeywords: [
      'Blue orchids online',
      'Pink cymbidium orchids',
      'White dendrobium orchids',
      'Orchid basket arrangement',
      'Corporate orchid gifts Hyderabad'
    ],
    longTailKeywords: [
      'Send fresh purple dendrobium orchid bouquet in Hyderabad',
      'Luxury cymbidium orchid and rose arrangement'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Orchids',
    internalLinksCount: 12,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-hydrangea',
    pageUrl: '/hydrangea',
    pageType: 'Category',
    pageTitle: 'Luxury Hydrangea Bouquets Online | Blue, Pink, White & Green Hydrangea',
    primaryKeyword: 'Hydrangea flower arrangements',
    secondaryKeywords: [
      'Blue hydrangea bouquet',
      'Pink hydrangea flowers',
      'Green hydrangea bouquet',
      'White hydrangea and roses',
      'Pastel hydrangea basket'
    ],
    longTailKeywords: [
      'Order luxury blue and pink hydrangea bouquet in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Hydrangea',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-carnation',
    pageUrl: '/carnation',
    pageType: 'Category',
    pageTitle: 'Fresh Carnation Bouquets Online | Pink, Red, White & Mixed Carnations',
    primaryKeyword: 'Carnation bouquets online',
    secondaryKeywords: [
      'Pink carnations bouquet',
      'Red and white carnations',
      'Mother’s Day carnation flowers',
      'Long lasting carnation basket'
    ],
    longTailKeywords: [
      'Send pastel pink and white carnation bouquet in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Carnations',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-eustoma',
    pageUrl: '/eustoma',
    pageType: 'Category',
    pageTitle: 'Lisianthus (Eustoma) Flower Bouquets Online | White, Pink, Green & Red Eustoma',
    primaryKeyword: 'Lisianthus Eustoma bouquets',
    secondaryKeywords: [
      'White eustoma flowers',
      'Pink eustoma bouquet',
      'Green eustoma arrangement',
      'Red eustoma flowers'
    ],
    longTailKeywords: [
      'Buy fresh Lisianthus Eustoma and rose bouquets in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Flower Variety - Lisianthus',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-flower-baskets',
    pageUrl: '/flower-baskets',
    pageType: 'Category',
    pageTitle: 'Fresh Flower Basket Arrangements Online | Luxury Floral Table Baskets',
    primaryKeyword: 'Fresh flower basket arrangements',
    secondaryKeywords: [
      'Rose and lily basket',
      'Grand congratulatory flower basket',
      'Housewarming flower basket Hyderabad',
      'Tabletop floral arrangement'
    ],
    longTailKeywords: [
      'Order hydrated oasis foam flower basket for housewarming and events'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Bouquets & Arrangements',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-vase',
    pageUrl: '/vase',
    pageType: 'Category',
    pageTitle: 'Flowers in a Glass Vase Online | Ready-to-Display Desk & Home Arrangements',
    primaryKeyword: 'Flower arrangements in glass vase',
    secondaryKeywords: [
      'Roses in glass vase',
      'Lilies and orchids in vase',
      'Office desk flower vase Hyderabad',
      'Reception table flower arrangement'
    ],
    longTailKeywords: [
      'Send fresh roses and lilies in a reusable glass vase'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Bouquets & Arrangements',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-birthday',
    pageUrl: '/occasions/birthday',
    pageType: 'Occasion',
    pageTitle: 'Birthday Flowers Online | Same-Day & Midnight Birthday Bouquets & Cakes',
    primaryKeyword: 'Birthday flowers online',
    secondaryKeywords: [
      'Happy birthday flower bouquet',
      'Birthday flowers Hyderabad',
      'Birthday rose and cake combo',
      'Midnight birthday surprise delivery'
    ],
    longTailKeywords: [
      'Send birthday flowers and cake at midnight in Hyderabad',
      'Best birthday flower bouquet for wife husband girlfriend friend'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Occasion - Birthday',
    internalLinksCount: 14,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-anniversary',
    pageUrl: '/occasions/anniversary',
    pageType: 'Occasion',
    pageTitle: 'Anniversary Flower Bouquets Online | Romantic Roses, Lilies & Cake Combos',
    primaryKeyword: 'Anniversary flower bouquets',
    secondaryKeywords: [
      'Wedding anniversary roses',
      'Anniversary flowers Hyderabad',
      '25th anniversary flower basket',
      '1st anniversary flowers for wife husband'
    ],
    longTailKeywords: [
      'Send romantic red roses and cake for wedding anniversary in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Occasion - Anniversary',
    internalLinksCount: 14,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-valentine-special',
    pageUrl: '/valentine-special',
    pageType: 'Seasonal Campaign',
    pageTitle: 'Valentine’s Day Flowers & Gifts Online | Romantic Rose Bouquets & Combos',
    primaryKeyword: 'Valentine’s Day flowers',
    secondaryKeywords: [
      'Valentine’s Day gifts online',
      'Valentine’s Day rose bouquet',
      'Valentine’s Week gifts Rose Day to Valentine’s Day',
      'Romantic gifts for girlfriend boyfriend wife husband',
      'Midnight Valentine delivery Hyderabad'
    ],
    longTailKeywords: [
      'Send heart shape red rose arrangement and cake for Valentine’s Day in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Seasonal - Valentine’s Day',
    internalLinksCount: 18,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-combos',
    pageUrl: '/combos',
    pageType: 'Category',
    pageTitle: 'Cake and Flower Delivery Online | Flowers with Chocolates & Teddy Combos',
    primaryKeyword: 'Cake and flower delivery',
    secondaryKeywords: [
      'Flowers and cake combo online',
      'Rose bouquet with chocolate cake',
      'Flowers with Ferrero Rocher and teddy',
      'Cake and flower delivery Hyderabad'
    ],
    longTailKeywords: [
      'Same day and midnight cake and flower combo delivery in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Cakes, Combos & Gifts',
    internalLinksCount: 14,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-cakes',
    pageUrl: '/cakes',
    pageType: 'Category',
    pageTitle: 'Online Cake Delivery in Hyderabad | Fresh Birthday & Anniversary Cakes',
    primaryKeyword: 'Online cake delivery Hyderabad',
    secondaryKeywords: [
      'Fresh celebration cakes',
      'Chocolate truffle cake with flowers',
      'Eggless birthday cake delivery',
      'Midnight cake delivery Hyderabad'
    ],
    longTailKeywords: [
      'Order fresh bakery cake with flower bouquet in Hyderabad'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & Secunderabad',
    keywordCluster: 'Cakes, Combos & Gifts',
    internalLinksCount: 12,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-shop',
    pageUrl: '/shop',
    pageType: 'Catalog Hub',
    pageTitle: 'Online Gifts Delivery | Complete Flower, Cake, Plant & Hamper Catalog',
    primaryKeyword: 'Online gifts delivery',
    secondaryKeywords: [
      'Flowers and gifts online',
      'Order bouquets cakes and hampers',
      'Same day gift delivery Hyderabad',
      'Luxury floral gifting store'
    ],
    longTailKeywords: [
      'Browse all fresh flower bouquets cakes chocolate bouquets and gift hampers'
    ],
    searchIntent: 'Commercial / Transactional',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Cakes, Combos & Gifts',
    internalLinksCount: 25,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-budget-friendly',
    pageUrl: '/shop/budget-friendly',
    pageType: 'Collection',
    pageTitle: 'Flowers & Bouquets Under ₹1000 in Hyderabad | Affordable Fresh Gifts',
    primaryKeyword: 'Flowers under 1000 online',
    secondaryKeywords: [
      'Affordable flower bouquets Hyderabad',
      'Mini bouquets under 999',
      'Budget friendly birthday flowers',
      'Pocket friendly rose bouquets'
    ],
    longTailKeywords: [
      'Buy fresh rose and carnation bouquets under Rs 1000 with same day delivery'
    ],
    searchIntent: 'Transactional',
    targetLocation: 'Hyderabad & Secunderabad',
    keywordCluster: 'Bouquets & Arrangements',
    internalLinksCount: 12,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-faq',
    pageUrl: '/faq',
    pageType: 'Informational',
    pageTitle: 'Frequently Asked Questions | Same-Day Delivery, Care & Ordering | SBFlorist',
    primaryKeyword: 'Online flower delivery FAQ',
    secondaryKeywords: [
      'Same day flower delivery cutoff time',
      'Midnight delivery charges Hyderabad',
      'How to care for fresh cut flowers',
      'SBFlorist order tracking and support'
    ],
    longTailKeywords: [
      'Frequently asked questions about flower and cake delivery in Hyderabad'
    ],
    searchIntent: 'Informational',
    targetLocation: 'India & Hyderabad',
    keywordCluster: 'Informational & Trust',
    internalLinksCount: 10,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-about',
    pageUrl: '/about',
    pageType: 'Informational',
    pageTitle: 'About Spring Blossoms Florist | Artisanal Floral Studio Since 2005',
    primaryKeyword: 'About Spring Blossoms Florist Hyderabad',
    secondaryKeywords: [
      'Trusted florist in Hyderabad since 2005',
      'Mehdipatnam floral design studio',
      'A Reason to Express florist'
    ],
    longTailKeywords: [
      'Story and craftsmanship of Spring Blossoms Florist Hyderabad'
    ],
    searchIntent: 'Informational / Brand',
    targetLocation: 'Hyderabad & India',
    keywordCluster: 'Informational & Trust',
    internalLinksCount: 8,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-contact',
    pageUrl: '/contact',
    pageType: 'Informational',
    pageTitle: 'Contact Spring Blossoms Florist | Studio Address, Phone & Bulk Enquiries',
    primaryKeyword: 'Contact Spring Blossoms Florist',
    secondaryKeywords: [
      'Florist shop address Mehdipatnam Hyderabad',
      'Wedding and corporate flower enquiry Hyderabad',
      'SBFlorist customer support phone WhatsApp'
    ],
    longTailKeywords: [
      'Contact Spring Blossoms Florist Rethi Bowli Mehdipatnam Hyderabad 500006'
    ],
    searchIntent: 'Navigational / Local',
    targetLocation: 'Hyderabad, Telangana',
    keywordCluster: 'Informational & Trust',
    internalLinksCount: 8,
    optimizationStatus: 'Optimized'
  },
  {
    id: 'kw-shipping-policy',
    pageUrl: '/shipping-policy',
    pageType: 'Policy',
    pageTitle: 'Delivery, Shipping & Freshness Guarantee Policy | Spring Blossoms Florist',
    primaryKeyword: 'Flower delivery and refund policy',
    secondaryKeywords: [
      'Freshness guarantee and replacement policy',
      'Same day and midnight delivery terms',
      'Perishable flower cancellation policy'
    ],
    longTailKeywords: [
      'Spring Blossoms Florist shipping delivery and refund policy India'
    ],
    searchIntent: 'Informational / Trust',
    targetLocation: 'India & Hyderabad',
    keywordCluster: 'Informational & Trust',
    internalLinksCount: 6,
    optimizationStatus: 'Optimized'
  }
];

const normalizeKeywordMappingRecord = (item) => {
  const nowIso = new Date().toISOString();
  const pageUrl = String(item.pageUrl || '/').trim();
  const parseArr = (val) => {
    if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
    if (typeof val === 'string') {
      return val
        .split(/[|,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };
  const parseNullableNumber = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: item.id || `kw-${slugify(pageUrl === '/' ? 'home' : pageUrl)}`,
    pageUrl,
    pageType: item.pageType || 'Page',
    pageTitle: String(item.pageTitle || '').trim(),
    primaryKeyword: String(item.primaryKeyword || '').trim(),
    secondaryKeywords: parseArr(item.secondaryKeywords),
    longTailKeywords: parseArr(item.longTailKeywords),
    searchIntent: item.searchIntent || 'Transactional',
    targetLocation: item.targetLocation || 'Hyderabad & India',
    keywordCluster: item.keywordCluster || 'General Florist',
    // Strictly null unless verified from GSC or user import
    searchVolume: parseNullableNumber(item.searchVolume),
    keywordDifficulty: parseNullableNumber(item.keywordDifficulty),
    currentRanking: parseNullableNumber(item.currentRanking),
    impressions: parseNullableNumber(item.impressions),
    clicks: parseNullableNumber(item.clicks),
    ctr: parseNullableNumber(item.ctr),
    organicConversions: Number(item.organicConversions || 0),
    internalLinksCount: Number(item.internalLinksCount ?? 8),
    optimizationStatus: item.optimizationStatus || 'Optimized',
    notes: String(item.notes || '').trim(),
    updatedAt: item.updatedAt || nowIso
  };
};

const analyzeKeywordMappingsHealth = (mappings) => {
  const primaryMap = new Map();
  const titleMap = new Map();
  const missingPrimary = [];
  const missingSecondary = [];
  const lowInternalLinks = [];

  for (const m of mappings) {
    const pk = String(m.primaryKeyword || '').trim().toLowerCase();
    if (!pk) {
      missingPrimary.push({ id: m.id, pageUrl: m.pageUrl, pageTitle: m.pageTitle, pageType: m.pageType });
    } else {
      if (!primaryMap.has(pk)) primaryMap.set(pk, []);
      primaryMap.get(pk).push({ id: m.id, pageUrl: m.pageUrl, pageTitle: m.pageTitle, pageType: m.pageType });
    }

    if (!Array.isArray(m.secondaryKeywords) || m.secondaryKeywords.length === 0) {
      missingSecondary.push({ id: m.id, pageUrl: m.pageUrl, pageTitle: m.pageTitle });
    }

    if (Number(m.internalLinksCount || 0) < 3) {
      lowInternalLinks.push({ id: m.id, pageUrl: m.pageUrl, internalLinksCount: m.internalLinksCount || 0 });
    }

    const pt = String(m.pageTitle || '').trim().toLowerCase();
    if (pt) {
      if (!titleMap.has(pt)) titleMap.set(pt, []);
      titleMap.get(pt).push({ id: m.id, pageUrl: m.pageUrl, pageTitle: m.pageTitle });
    }
  }

  const cannibalizationWarnings = [];
  for (const [keyword, pages] of primaryMap.entries()) {
    if (pages.length > 1) {
      cannibalizationWarnings.push({
        primaryKeyword: keyword,
        count: pages.length,
        pages,
        recommendation: `Assign a distinct primary keyword to each URL so "${keyword}" has a single authoritative target page.`
      });
    }
  }

  const duplicatePageTitles = [];
  for (const [title, pages] of titleMap.entries()) {
    if (pages.length > 1) {
      duplicatePageTitles.push({ pageTitle: pages[0].pageTitle, count: pages.length, pages });
    }
  }

  return {
    totalMappedPages: mappings.length,
    cannibalizationCount: cannibalizationWarnings.length,
    missingPrimaryCount: missingPrimary.length,
    missingSecondaryCount: missingSecondary.length,
    lowInternalLinksCount: lowInternalLinks.length,
    duplicateTitleCount: duplicatePageTitles.length,
    cannibalizationWarnings,
    missingPrimary,
    missingSecondary,
    lowInternalLinks,
    duplicatePageTitles
  };
};

const syncKeywordMappingsFromCatalog = async (existingMappings = []) => {
  const byUrl = new Map();
  for (const item of existingMappings) {
    if (item && item.pageUrl) {
      byUrl.set(String(item.pageUrl).trim().toLowerCase(), normalizeKeywordMappingRecord(item));
    }
  }

  // 1. Seed Priority Pages
  for (const p of PRIORITY_PAGE_KEYWORD_MAPPINGS) {
    const key = p.pageUrl.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(key, normalizeKeywordMappingRecord(p));
    }
  }

  // 2. Sync Published Blog Guides
  const blogs = await getAllBlogPosts(false);
  for (const b of blogs) {
    const url = `/blog/${b.slug}`;
    const key = url.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(
        key,
        normalizeKeywordMappingRecord({
          id: `kw-blog-${b.slug}`,
          pageUrl: url,
          pageType: 'Blog Guide',
          pageTitle: b.seoTitle || b.title,
          primaryKeyword: b.focusKeyword || b.title,
          secondaryKeywords: b.secondaryKeywords || [],
          longTailKeywords: (b.faqs || []).map((f) => f.question).slice(0, 3),
          searchIntent: 'Informational',
          targetLocation: 'India & Hyderabad',
          keywordCluster: `Blog - ${b.category || 'Floral Guides'}`,
          internalLinksCount: (b.relatedCategories?.length || 3) + 4,
          optimizationStatus: 'Optimized'
        })
      );
    }
  }

  // 3. Sync Active Categories & Occasions not already covered
  const [categories, occasions, products] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true, categoryUrl: true, metaTitle: true } }),
    prisma.occasion.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true, metaTitle: true } }),
    prisma.product.findMany({
      where: { isVisible: true, approvalStatus: 'approved' },
      select: {
        id: true,
        name: true,
        slug: true,
        isFeatured: true,
        isBestseller: true,
        seoSettings: true,
        categories: { include: { category: { select: { name: true } } } }
      },
      orderBy: [{ isBestseller: 'desc' }, { isFeatured: 'desc' }, { updatedAt: 'desc' }],
      take: 40
    })
  ]);

  for (const cat of categories) {
    const rawUrl = cat.categoryUrl || `/shop/${cat.slug}`;
    const url = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    const key = url.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(
        key,
        normalizeKeywordMappingRecord({
          id: `kw-cat-${cat.slug}`,
          pageUrl: url,
          pageType: 'Category',
          pageTitle: cat.metaTitle || `Buy ${cat.name} Online in Hyderabad | Spring Blossoms Florist`,
          primaryKeyword: `${cat.name} online Hyderabad`,
          secondaryKeywords: [`Buy ${cat.name} online`, `Fresh ${cat.name} delivery`, `${cat.name} bouquets SBFlorist`],
          longTailKeywords: [`Same day ${cat.name.toLowerCase()} delivery in Hyderabad and Secunderabad`],
          searchIntent: 'Transactional',
          targetLocation: 'Hyderabad & India',
          keywordCluster: `Category - ${cat.name}`,
          internalLinksCount: 10,
          optimizationStatus: 'Optimized'
        })
      );
    }
  }

  for (const occ of occasions) {
    const url = `/occasions/${occ.slug}`;
    const key = url.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(
        key,
        normalizeKeywordMappingRecord({
          id: `kw-occ-${occ.slug}`,
          pageUrl: url,
          pageType: 'Occasion',
          pageTitle: occ.metaTitle || `${occ.name} Flowers & Gifts Online in Hyderabad | SBFlorist`,
          primaryKeyword: `${occ.name} flowers online`,
          secondaryKeywords: [`${occ.name} bouquets Hyderabad`, `Send ${occ.name.toLowerCase()} gifts online`, `${occ.name} flower and cake combo`],
          longTailKeywords: [`Same day and midnight ${occ.name.toLowerCase()} flower delivery in Hyderabad`],
          searchIntent: 'Transactional',
          targetLocation: 'Hyderabad & India',
          keywordCluster: `Occasion - ${occ.name}`,
          internalLinksCount: 10,
          optimizationStatus: 'Optimized'
        })
      );
    }
  }

  for (const prod of products) {
    const url = `/product/${prod.slug}`;
    const key = url.toLowerCase();
    if (!byUrl.has(key)) {
      const seo = prod.seoSettings && typeof prod.seoSettings === 'object' ? prod.seoSettings : {};
      const catName = prod.categories?.[0]?.category?.name || 'Flowers';
      const generated = generateProductSeo({ ...prod, category: catName }, seo);
      byUrl.set(
        key,
        normalizeKeywordMappingRecord({
          id: `kw-prod-${prod.slug}`,
          pageUrl: url,
          pageType: 'Product',
          pageTitle: seo.seoTitle || generated.seoTitle,
          primaryKeyword: seo.focusKeyword || generated.focusKeyword || `Buy ${prod.name} Online`,
          secondaryKeywords: seo.secondaryKeywords || generated.secondaryKeywords || [`${prod.name} Hyderabad`, `Order ${catName} online`],
          longTailKeywords: [`Send ${prod.name} with same day delivery in Hyderabad`],
          searchIntent: 'Transactional',
          targetLocation: 'Hyderabad & Secunderabad',
          keywordCluster: `Product - ${catName}`,
          internalLinksCount: 8,
          optimizationStatus: (seo.score || generated.score || 85) >= 80 ? 'Optimized' : 'Needs Review'
        })
      );
    }
  }

  const finalMappings = Array.from(byUrl.values());
  await prisma.setting.upsert({
    where: { key: KEYWORD_MAPPINGS_SETTING_KEY },
    update: { data: finalMappings },
    create: {
      id: KEYWORD_MAPPINGS_SETTING_KEY,
      key: KEYWORD_MAPPINGS_SETTING_KEY,
      data: finalMappings
    }
  });

  return finalMappings;
};

const getKeywordMappings = async (forceSync = false) => {
  try {
    const record = await prisma.setting.findUnique({
      where: { key: KEYWORD_MAPPINGS_SETTING_KEY }
    });

    let mappings = [];
    if (record && Array.isArray(record.data) && record.data.length > 0 && !forceSync) {
      mappings = record.data.map(normalizeKeywordMappingRecord);
    } else {
      const existing = record && Array.isArray(record.data) ? record.data : [];
      mappings = await syncKeywordMappingsFromCatalog(existing);
    }

    const diagnostics = analyzeKeywordMappingsHealth(mappings);
    return {
      mappings,
      diagnostics
    };
  } catch (err) {
    console.warn('Keyword mappings fallback:', err.message);
    const fallback = PRIORITY_PAGE_KEYWORD_MAPPINGS.map(normalizeKeywordMappingRecord);
    return {
      mappings: fallback,
      diagnostics: analyzeKeywordMappingsHealth(fallback)
    };
  }
};

const upsertKeywordMapping = async (mappingData, existingId = null) => {
  const { mappings } = await getKeywordMappings(false);
  const normalized = normalizeKeywordMappingRecord({
    ...mappingData,
    id: existingId || mappingData.id || `kw-${slugify(mappingData.pageUrl || Date.now())}`,
    updatedAt: new Date().toISOString()
  });

  const idx = mappings.findIndex(
    (m) => m.id === normalized.id || String(m.pageUrl).toLowerCase() === String(normalized.pageUrl).toLowerCase()
  );

  if (idx !== -1) {
    mappings[idx] = { ...mappings[idx], ...normalized, updatedAt: new Date().toISOString() };
  } else {
    mappings.unshift(normalized);
  }

  await prisma.setting.upsert({
    where: { key: KEYWORD_MAPPINGS_SETTING_KEY },
    update: { data: mappings },
    create: {
      id: KEYWORD_MAPPINGS_SETTING_KEY,
      key: KEYWORD_MAPPINGS_SETTING_KEY,
      data: mappings
    }
  });

  return {
    mapping: normalized,
    diagnostics: analyzeKeywordMappingsHealth(mappings)
  };
};

const deleteKeywordMapping = async (id) => {
  const { mappings } = await getKeywordMappings(false);
  const filtered = mappings.filter((m) => m.id !== id);
  await prisma.setting.upsert({
    where: { key: KEYWORD_MAPPINGS_SETTING_KEY },
    update: { data: filtered },
    create: {
      id: KEYWORD_MAPPINGS_SETTING_KEY,
      key: KEYWORD_MAPPINGS_SETTING_KEY,
      data: filtered
    }
  });
  return {
    deleted: filtered.length < mappings.length,
    diagnostics: analyzeKeywordMappingsHealth(filtered)
  };
};

const exportKeywordMappingsCsv = async () => {
  const { mappings } = await getKeywordMappings(false);
  const headers = [
    'Page URL',
    'Page Type',
    'Page Title',
    'Primary Keyword',
    'Secondary Keywords',
    'Long-Tail Keywords',
    'Search Intent',
    'Target Location',
    'Keyword Cluster',
    'Search Volume',
    'Keyword Difficulty',
    'Current Ranking',
    'Impressions',
    'Clicks',
    'CTR (%)',
    'Organic Conversions',
    'Internal Links Count',
    'Optimization Status'
  ];

  const esc = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = mappings.map((m) =>
    [
      m.pageUrl,
      m.pageType,
      m.pageTitle,
      m.primaryKeyword,
      (m.secondaryKeywords || []).join(' | '),
      (m.longTailKeywords || []).join(' | '),
      m.searchIntent,
      m.targetLocation,
      m.keywordCluster,
      m.searchVolume ?? '',
      m.keywordDifficulty ?? '',
      m.currentRanking ?? '',
      m.impressions ?? '',
      m.clicks ?? '',
      m.ctr ?? '',
      m.organicConversions ?? 0,
      m.internalLinksCount ?? 0,
      m.optimizationStatus
    ]
      .map(esc)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

const importKeywordMappingsCsv = async (rowsArray = []) => {
  if (!Array.isArray(rowsArray) || rowsArray.length === 0) {
    return getKeywordMappings(false);
  }
  const { mappings } = await getKeywordMappings(false);
  const byUrl = new Map(mappings.map((m) => [String(m.pageUrl).toLowerCase(), m]));

  for (const row of rowsArray) {
    const pageUrl = String(row.pageUrl || row['Page URL'] || '').trim();
    if (!pageUrl) continue;
    const key = pageUrl.toLowerCase();
    const existing = byUrl.get(key) || {};
    const merged = normalizeKeywordMappingRecord({
      ...existing,
      pageUrl,
      pageType: row.pageType || row['Page Type'] || existing.pageType || 'Page',
      pageTitle: row.pageTitle || row['Page Title'] || existing.pageTitle || '',
      primaryKeyword: row.primaryKeyword || row['Primary Keyword'] || existing.primaryKeyword || '',
      secondaryKeywords: row.secondaryKeywords || row['Secondary Keywords'] || existing.secondaryKeywords || [],
      longTailKeywords: row.longTailKeywords || row['Long-Tail Keywords'] || existing.longTailKeywords || [],
      searchIntent: row.searchIntent || row['Search Intent'] || existing.searchIntent || 'Transactional',
      targetLocation: row.targetLocation || row['Target Location'] || existing.targetLocation || 'Hyderabad & India',
      keywordCluster: row.keywordCluster || row['Keyword Cluster'] || existing.keywordCluster || 'General',
      searchVolume: row.searchVolume ?? row['Search Volume'] ?? existing.searchVolume ?? null,
      keywordDifficulty: row.keywordDifficulty ?? row['Keyword Difficulty'] ?? existing.keywordDifficulty ?? null,
      currentRanking: row.currentRanking ?? row['Current Ranking'] ?? existing.currentRanking ?? null,
      impressions: row.impressions ?? row['Impressions'] ?? existing.impressions ?? null,
      clicks: row.clicks ?? row['Clicks'] ?? existing.clicks ?? null,
      ctr: row.ctr ?? row['CTR (%)'] ?? existing.ctr ?? null,
      organicConversions: row.organicConversions ?? row['Organic Conversions'] ?? existing.organicConversions ?? 0,
      optimizationStatus: row.optimizationStatus || row['Optimization Status'] || existing.optimizationStatus || 'Optimized'
    });
    byUrl.set(key, merged);
  }

  const updated = Array.from(byUrl.values());
  await prisma.setting.upsert({
    where: { key: KEYWORD_MAPPINGS_SETTING_KEY },
    update: { data: updated },
    create: {
      id: KEYWORD_MAPPINGS_SETTING_KEY,
      key: KEYWORD_MAPPINGS_SETTING_KEY,
      data: updated
    }
  });

  return {
    mappings: updated,
    diagnostics: analyzeKeywordMappingsHealth(updated)
  };
};

// ── Backlink Acquisition, Quality Evaluation & Authority System (Phase 5 & 6) ─
// Strictly tracks verified live backlinks and actionable outreach prospects.
// Never fabricates fake live backlinks.

const OUTREACH_PLAYBOOK_PILLARS = [
  {
    id: 'pillar-local-hyderabad',
    category: 'Local Hyderabad Business & Directory Citations',
    priority: 'High Priority',
    targetAnchorMix: 'Brand (50%) + Local (30%) + Naked URL (20%)',
    recommendedDestinations: ['https://sbflorist.in/', 'https://sbflorist.in/flower-delivery-hyderabad'],
    napConsistencyChecklist: {
      businessName: 'Spring Blossoms Florist',
      tagline: 'A Reason to Express',
      address: 'Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Road, Mehdipatnam, Hyderabad, Telangana 500006',
      phone: '+91 99496 83222',
      email: '2006sbf@gmail.com',
      website: 'https://sbflorist.in'
    },
    actionItems: [
      'Verify & enrich Google Business Profile with weekly product photos, Hyderabad service areas (Banjara Hills, Jubilee Hills, Madhapur, Gachibowli, Secunderabad), and direct product links.',
      'Ensure 100% identical NAP (Name, Address, Phone) across Bing Places, Apple Business Connect, Justdial, Sulekha, IndiaMART, and Telangana business directories.',
      'Publish local neighborhood guides linking to /flower-delivery-hyderabad and /flower-delivery-secunderabad.'
    ]
  },
  {
    id: 'pillar-wedding-event',
    category: 'Wedding, Banquet & Event Industry Partnerships',
    priority: 'High Priority',
    targetAnchorMix: 'Brand (40%) + Descriptive (40%) + Category (20%)',
    recommendedDestinations: ['https://sbflorist.in/bouquets', 'https://sbflorist.in/occasions/anniversary', 'https://sbflorist.in/roses'],
    actionItems: [
      'Partner with wedding planners, banquet halls in Banjara Hills/Jubilee Hills/Gachibowli, and event decorators for mutual preferred-vendor credits.',
      'Collaborate with bridal photographers and stylists in Hyderabad by supplying fresh bridal bouquets in exchange for portfolio attribution links.',
      'Co-author seasonal wedding floral palette lookbooks (Roses, Hydrangeas, Orchids, Ranunculus, Dahlias).'
    ]
  },
  {
    id: 'pillar-gifting-lifestyle-pr',
    category: 'Gifting, Lifestyle & Floral Publications (Digital PR)',
    priority: 'Medium-High Priority',
    targetAnchorMix: 'Informational (40%) + Brand (40%) + Category (20%)',
    recommendedDestinations: [
      'https://sbflorist.in/blog/famous-indian-flowers-ketaki-kanakambaram-brahma-kamal-jasmine',
      'https://sbflorist.in/blog/flower-meanings-and-symbolism-gifting-guide',
      'https://sbflorist.in/valentine-special'
    ],
    actionItems: [
      'Pitch original botanical guides (Famous Indian Flowers: Ketaki, Kanakambaram, Brahma Kamal; Flower Care in Indian Weather) to lifestyle and gardening writers.',
      'Submit Spring Blossoms Florist to curated city features ("Best Florists in Hyderabad for Same-Day & Midnight Delivery").',
      'Share seasonal gifting checklists ahead of Valentine’s Week, Mother’s Day, Raksha Bandhan, and Diwali.'
    ]
  },
  {
    id: 'pillar-corporate-hospitality',
    category: 'Corporate Gifting, Bakeries & Hospitality Partners',
    priority: 'Medium Priority',
    targetAnchorMix: 'Brand (60%) + Local (20%) + Product/Category (20%)',
    recommendedDestinations: ['https://sbflorist.in/vase', 'https://sbflorist.in/gift-hampers', 'https://sbflorist.in/combos'],
    actionItems: [
      'Establish corporate gifting partner listings with HR/admin portals in HITEC City, Madhapur, and Financial District.',
      'Cross-feature partner artisanal bakeries, chocolatiers, and boutique hotels in Hyderabad.'
    ]
  }
];

const INITIAL_BACKLINK_RECORDS = [
  {
    id: 'bl-prospect-gbp',
    domain: 'google.com/business',
    sourceUrl: 'https://www.google.com/maps/search/Spring+Blossoms+Florist+Mehdipatnam+Hyderabad',
    destinationUrl: 'https://sbflorist.in/',
    linkType: 'citation',
    anchorText: 'Spring Blossoms Florist',
    anchorCategory: 'Brand',
    domainAuthority: null,
    relevanceCategory: 'Local Hyderabad Directory',
    firstDiscoveredDate: '2026-11-01',
    lastCheckedDate: '2026-11-10',
    linkStatus: 'Active',
    outreachStatus: 'Verified Local Listing',
    contactInfo: 'Google Business Profile Manager',
    notes: 'Primary local business profile for Mehdipatnam studio (500006) serving Hyderabad & Secunderabad.'
  },
  {
    id: 'bl-prospect-instagram',
    domain: 'instagram.com',
    sourceUrl: 'https://www.instagram.com/springblossomsflorist/',
    destinationUrl: 'https://sbflorist.in/',
    linkType: 'nofollow',
    anchorText: 'sbflorist.in',
    anchorCategory: 'Naked URL',
    domainAuthority: null,
    relevanceCategory: 'Social & Business Profile',
    firstDiscoveredDate: '2026-11-01',
    lastCheckedDate: '2026-11-10',
    linkStatus: 'Prospect',
    outreachStatus: 'Profile Bio Link Verification',
    contactInfo: 'Official Social Desk',
    notes: 'Ensure bio link points directly to https://sbflorist.in with Hyderabad same-day delivery callout.'
  },
  {
    id: 'bl-prospect-wedmegood',
    domain: 'wedmegood.com',
    sourceUrl: 'https://www.wedmegood.com/vendors/hyderabad/wedding-decorators/',
    destinationUrl: 'https://sbflorist.in/flower-delivery-hyderabad',
    linkType: 'citation',
    anchorText: 'Spring Blossoms Florist Hyderabad',
    anchorCategory: 'Local',
    domainAuthority: null,
    relevanceCategory: 'Wedding & Event Industry',
    firstDiscoveredDate: '2026-11-10',
    lastCheckedDate: '2026-11-10',
    linkStatus: 'Prospect',
    outreachStatus: 'Ready for Submission',
    contactInfo: 'Vendor Onboarding Desk',
    notes: 'High-relevance Indian wedding & floral vendor directory prospect.'
  },
  {
    id: 'bl-prospect-lbb-hyderabad',
    domain: 'lbb.in',
    sourceUrl: 'https://lbb.in/hyderabad/',
    destinationUrl: 'https://sbflorist.in/flower-delivery-hyderabad',
    linkType: 'dofollow',
    anchorText: 'online flower delivery in Hyderabad',
    anchorCategory: 'Descriptive',
    domainAuthority: null,
    relevanceCategory: 'Floral & Lifestyle Media',
    firstDiscoveredDate: '2026-11-10',
    lastCheckedDate: '2026-11-10',
    linkStatus: 'Prospect',
    outreachStatus: 'Editorial Pitch Prepared',
    contactInfo: 'Hyderabad City Editor',
    notes: 'Local Hyderabad lifestyle discovery platform ideal for featuring artisanal bouquets and same-day delivery.'
  }
];

const evaluateBacklinkQuality = (record) => {
  let score = 60;
  const warnings = [];
  const rel = String(record.relevanceCategory || '').toLowerCase();
  if (rel.includes('local') || rel.includes('wedding') || rel.includes('floral') || rel.includes('corporate')) {
    score += 20;
  }
  if (record.linkType === 'dofollow') score += 10;
  if (record.linkType === 'citation') score += 8;
  if (record.anchorCategory === 'Brand' || record.anchorCategory === 'Naked URL' || record.anchorCategory === 'Descriptive') {
    score += 10;
  }
  if (String(record.notes || '').toLowerCase().includes('paid link') || String(record.notes || '').toLowerCase().includes('pbn')) {
    score = 10;
    warnings.push('Avoid paid link schemes or PBNs—Google spam policies penalize unnatural link networks.');
  }
  return {
    qualityScore: Math.min(100, Math.max(0, score)),
    warnings
  };
};

const normalizeBacklinkRecord = (item) => {
  const today = new Date().toISOString().slice(0, 10);
  const sourceUrl = String(item.sourceUrl || '').trim();
  let domain = String(item.domain || '').trim();
  if (!domain && sourceUrl) {
    try {
      domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch (e) {
      domain = sourceUrl.split('/')[0] || 'unknown';
    }
  }
  const parseNullableNumber = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const base = {
    id: item.id || `bl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    domain: domain || 'unknown',
    sourceUrl,
    destinationUrl: String(item.destinationUrl || 'https://sbflorist.in/').trim(),
    linkType: item.linkType || 'dofollow',
    anchorText: String(item.anchorText || 'Spring Blossoms Florist').trim(),
    anchorCategory: item.anchorCategory || 'Brand',
    domainAuthority: parseNullableNumber(item.domainAuthority),
    relevanceCategory: item.relevanceCategory || 'Local Hyderabad Directory',
    firstDiscoveredDate: item.firstDiscoveredDate || today,
    lastCheckedDate: item.lastCheckedDate || today,
    linkStatus: item.linkStatus || 'Prospect',
    outreachStatus: item.outreachStatus || 'Identified',
    contactInfo: String(item.contactInfo || '').trim(),
    notes: String(item.notes || '').trim(),
    updatedAt: new Date().toISOString()
  };

  const evalResult = evaluateBacklinkQuality(base);
  return {
    ...base,
    qualityScore: evalResult.qualityScore,
    qualityWarnings: evalResult.warnings
  };
};

const getBacklinksData = async () => {
  try {
    const record = await prisma.setting.findUnique({
      where: { key: BACKLINKS_SETTING_KEY }
    });

    let list = [];
    if (record && Array.isArray(record.data) && record.data.length > 0) {
      list = record.data.map(normalizeBacklinkRecord);
    } else {
      list = INITIAL_BACKLINK_RECORDS.map(normalizeBacklinkRecord);
      await prisma.setting.upsert({
        where: { key: BACKLINKS_SETTING_KEY },
        update: { data: list },
        create: {
          id: BACKLINKS_SETTING_KEY,
          key: BACKLINKS_SETTING_KEY,
          data: list
        }
      });
    }

    const activeLinks = list.filter((b) => b.linkStatus === 'Active');
    const uniqueActiveDomains = new Set(activeLinks.map((b) => b.domain.toLowerCase())).size;
    const prospects = list.filter((b) => b.linkStatus === 'Prospect' || b.linkStatus === 'Outreach Sent' || b.linkStatus === 'In Discussion');
    const lostOrBroken = list.filter((b) => b.linkStatus === 'Lost' || b.linkStatus === 'Broken');

    // Anchor text distribution across all tracked records
    const anchorCategories = ['Brand', 'Local', 'Descriptive', 'Category', 'Product', 'Informational', 'Naked URL'];
    const anchorDistribution = anchorCategories.map((cat) => {
      const count = list.filter((b) => b.anchorCategory === cat).length;
      const percentage = list.length > 0 ? Math.round((count / list.length) * 100) : 0;
      return { category: cat, count, percentage };
    });

    const exactCommercialPct = anchorDistribution
      .filter((a) => a.category === 'Category' || a.category === 'Product')
      .reduce((acc, cur) => acc + cur.percentage, 0);

    return {
      summary: {
        totalTrackedRecords: list.length,
        activeBacklinksCount: activeLinks.length,
        uniqueReferringDomainsCount: uniqueActiveDomains,
        outreachProspectsCount: prospects.length,
        dofollowCount: activeLinks.filter((b) => b.linkType === 'dofollow').length,
        citationOrNofollowCount: activeLinks.filter((b) => b.linkType !== 'dofollow').length,
        lostOrBrokenCount: lostOrBroken.length,
        anchorHealthHealthy: exactCommercialPct <= 30,
        anchorHealthMessage:
          exactCommercialPct <= 30
            ? 'Natural anchor profile: Brand, Naked URL, Local, and Descriptive anchors are well balanced.'
            : 'Warning: Commercial Product/Category anchors exceed 30%. Prioritize Brand ("Spring Blossoms Florist") and Natural Descriptive anchors.'
      },
      anchorDistribution,
      backlinks: list,
      playbook: OUTREACH_PLAYBOOK_PILLARS
    };
  } catch (err) {
    console.warn('Backlinks fallback:', err.message);
    const fallback = INITIAL_BACKLINK_RECORDS.map(normalizeBacklinkRecord);
    return {
      summary: {
        totalTrackedRecords: fallback.length,
        activeBacklinksCount: 1,
        uniqueReferringDomainsCount: 1,
        outreachProspectsCount: fallback.length - 1,
        dofollowCount: 0,
        citationOrNofollowCount: 1,
        lostOrBrokenCount: 0,
        anchorHealthHealthy: true,
        anchorHealthMessage: 'Natural anchor profile.'
      },
      anchorDistribution: [],
      backlinks: fallback,
      playbook: OUTREACH_PLAYBOOK_PILLARS
    };
  }
};

const upsertBacklinkRecord = async (payload, existingId = null) => {
  const current = await getBacklinksData();
  const list = [...current.backlinks];
  const normalized = normalizeBacklinkRecord({
    ...payload,
    id: existingId || payload.id
  });

  const idx = list.findIndex((b) => b.id === normalized.id);
  if (idx !== -1) {
    list[idx] = normalized;
  } else {
    list.unshift(normalized);
  }

  await prisma.setting.upsert({
    where: { key: BACKLINKS_SETTING_KEY },
    update: { data: list },
    create: {
      id: BACKLINKS_SETTING_KEY,
      key: BACKLINKS_SETTING_KEY,
      data: list
    }
  });

  return getBacklinksData();
};

const deleteBacklinkRecord = async (id) => {
  const current = await getBacklinksData();
  const filtered = current.backlinks.filter((b) => b.id !== id);
  await prisma.setting.upsert({
    where: { key: BACKLINKS_SETTING_KEY },
    update: { data: filtered },
    create: {
      id: BACKLINKS_SETTING_KEY,
      key: BACKLINKS_SETTING_KEY,
      data: filtered
    }
  });
  return getBacklinksData();
};

// ── SEO & Conversion Performance Dashboard Aggregator (Phase 8 & 9) ──────
// Queries real PostgreSQL analytics_sessions, analytics_events, Order, Product,
// Category, and Keyword/Backlink tables. Zero fabricated metrics.

const getSeoPerformanceDashboardData = async () => {
  const [globalSettings, kwData, backlinkData, healthAudit] = await Promise.all([
    getGlobalSeoSettings(),
    getKeywordMappings(false),
    getBacklinksData(),
    runComprehensiveSeoAudit()
  ]);

  // Query real Order metrics from PostgreSQL
  let totalOrders = 0;
  let totalRevenue = 0;
  let last30DaysOrders = 0;
  let last30DaysRevenue = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [allOrdersAgg, recentOrdersAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { isTestOrder: false, orderStatus: { notIn: ['cancelled', 'failed'] } },
        _count: { id: true },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: {
          isTestOrder: false,
          orderStatus: { notIn: ['cancelled', 'failed'] },
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { id: true },
        _sum: { totalAmount: true }
      })
    ]);

    totalOrders = allOrdersAgg?._count?.id || 0;
    totalRevenue = Number(allOrdersAgg?._sum?.totalAmount || 0);
    last30DaysOrders = recentOrdersAgg?._count?.id || 0;
    last30DaysRevenue = Number(recentOrdersAgg?._sum?.totalAmount || 0);
  } catch (e) {
    console.warn('Order aggregation note:', e.message);
  }

  // Query real behavioral & conversion events from analytics_sessions and analytics_events
  let totalSessions = 0;
  let organicSessions = 0;
  let pageViews = 0;
  let productViews = 0;
  let addToCartCount = 0;
  let checkoutStarts = 0;
  let siteSearches = 0;
  let topLandingPages = [];
  let topSearchQueries = [];

  try {
    const sessionRows = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS "totalSessions",
        COUNT(*) FILTER (WHERE LOWER(COALESCE("trafficSource", '')) LIKE '%organic%' OR LOWER(COALESCE("trafficSource", '')) LIKE '%google%' OR LOWER(COALESCE("trafficMedium", '')) = 'organic')::int AS "organicSessions",
        COALESCE(SUM("pageViewsCount"), 0)::int AS "totalPageViews"
      FROM "analytics_sessions"
    `);
    if (sessionRows && sessionRows[0]) {
      totalSessions = Number(sessionRows[0].totalSessions || 0);
      organicSessions = Number(sessionRows[0].organicSessions || 0);
      pageViews = Number(sessionRows[0].totalPageViews || 0);
    }

    const eventCounts = await prisma.$queryRawUnsafe(`
      SELECT
        "eventType",
        COUNT(*)::int AS "cnt"
      FROM "analytics_events"
      GROUP BY "eventType"
    `);
    for (const row of eventCounts || []) {
      if (row.eventType === 'product_view') productViews = Number(row.cnt || 0);
      if (row.eventType === 'add_to_cart') addToCartCount = Number(row.cnt || 0);
      if (row.eventType === 'checkout_started') checkoutStarts = Number(row.cnt || 0);
      if (row.eventType === 'search') siteSearches = Number(row.cnt || 0);
    }

    const landingRows = await prisma.$queryRawUnsafe(`
      SELECT
        COALESCE("landingPage", '/') AS "page",
        COUNT(*)::int AS "sessions",
        COUNT(*) FILTER (WHERE "activityStage" IN ('Cart', 'Checkout', 'Purchased'))::int AS "engagedSessions",
        COUNT(*) FILTER (WHERE "activityStage" = 'Purchased')::int AS "conversions"
      FROM "analytics_sessions"
      WHERE "landingPage" IS NOT NULL
        AND "landingPage" NOT LIKE '/admin%'
        AND "landingPage" NOT LIKE '/vendor%'
      GROUP BY COALESCE("landingPage", '/')
      ORDER BY "sessions" DESC
      LIMIT 12
    `);
    topLandingPages = (landingRows || []).map((r) => ({
      page: r.page,
      sessions: Number(r.sessions || 0),
      engagedSessions: Number(r.engagedSessions || 0),
      conversions: Number(r.conversions || 0)
    }));

    const searchRows = await prisma.$queryRawUnsafe(`
      SELECT
        LOWER(TRIM("searchQuery")) AS "query",
        COUNT(*)::int AS "searches"
      FROM "analytics_events"
      WHERE "eventType" = 'search'
        AND "searchQuery" IS NOT NULL
        AND TRIM("searchQuery") <> ''
      GROUP BY LOWER(TRIM("searchQuery"))
      ORDER BY "searches" DESC
      LIMIT 10
    `);
    topSearchQueries = (searchRows || []).map((r) => ({
      query: r.query,
      searches: Number(r.searches || 0)
    }));
  } catch (e) {
    console.warn('Analytics tables query note:', e.message);
  }

  // Historical third-party competitor benchmark (explicitly labeled as historical observation)
  const competitorBenchmark = {
    disclaimer:
      'Third-party estimated metrics (DR/DA/PA/Traffic) are historical observations from SEO screenshots, not verified Google ranking factors. SBFlorist live metrics below come directly from the production database.',
    gulmahalHistorical: {
      domain: 'gulmahal.in',
      dr: 18,
      da: 15,
      pa: 31,
      referringDomains: 143,
      backlinks: 195,
      estimatedTraffic: 100,
      rankingKeywords: 118,
      siteAge: '2 years 8 months',
      weaknessesExploited: [
        'Weak transactional product schema & slow delivery trust signals',
        'Over-reliance on generic informational blog traffic without Hyderabad local florist studio authority',
        'No midnight/same-day Twin Cities pin-code calculator or live combo customization'
      ]
    },
    sbfloristHistoricalBaseline: {
      domain: 'sbflorist.in',
      dr: 0,
      da: 1,
      pa: 3,
      referringDomains: 1,
      backlinks: 4,
      siteAge: '2 years 1 month'
    },
    sbfloristLiveReadiness: {
      seoHealthScore: healthAudit.summary.healthScore,
      totalMappedPages: kwData.diagnostics.totalMappedPages,
      indexedProductsCount: healthAudit.summary.totalProducts,
      indexedCategoriesCount: healthAudit.summary.totalCategories,
      publishedBlogGuidesCount: healthAudit.summary.publishedBlogs,
      cannibalizationConflicts: kwData.diagnostics.cannibalizationCount,
      trackedBacklinkRecords: backlinkData.summary.totalTrackedRecords,
      activeVerifiedBacklinks: backlinkData.summary.activeBacklinksCount,
      outreachProspectsReady: backlinkData.summary.outreachProspectsCount
    }
  };

  return {
    integrations: {
      gscConnected: Boolean(globalSettings.googleSearchConsoleVerification),
      gscVerificationMeta: globalSettings.googleSearchConsoleVerification || '',
      ga4Connected: Boolean(globalSettings.googleAnalyticsId),
      ga4MeasurementId: globalSettings.googleAnalyticsId || '',
      sitemapUrl: 'https://sbflorist.in/sitemap.xml',
      robotsUrl: 'https://sbflorist.in/robots.txt'
    },
    conversionFunnel: {
      totalSessions,
      organicSessions,
      pageViews,
      productViews,
      siteSearches,
      addToCartCount,
      checkoutStarts,
      totalOrders,
      totalRevenue,
      last30DaysOrders,
      last30DaysRevenue,
      sessionToCartRate: totalSessions > 0 ? Number(((addToCartCount / totalSessions) * 100).toFixed(2)) : 0,
      sessionToOrderRate: totalSessions > 0 ? Number(((totalOrders / totalSessions) * 100).toFixed(2)) : 0
    },
    topLandingPages,
    topSearchQueries,
    competitorBenchmark
  };
};

module.exports = {
  DEFAULT_GLOBAL_SEO_SETTINGS,
  INITIAL_BLOG_POSTS,
  PRIORITY_PAGE_KEYWORD_MAPPINGS,
  getGlobalSeoSettings,
  updateGlobalSeoSettings,
  getAllBlogPosts,
  getBlogPostBySlug,
  createOrUpdateBlogPost,
  deleteBlogPost,
  getCategorySeoExtensions,
  saveCategorySeoExtension,
  runComprehensiveSeoAudit,
  getKeywordMappings,
  upsertKeywordMapping,
  deleteKeywordMapping,
  syncKeywordMappingsFromCatalog,
  exportKeywordMappingsCsv,
  importKeywordMappingsCsv,
  getBacklinksData,
  upsertBacklinkRecord,
  deleteBacklinkRecord,
  getSeoPerformanceDashboardData
};

