// SBF Florist - Global SEO Settings, Blog Content Engine & SEO Health Diagnostics Service
// Persists all data in PostgreSQL via Prisma Setting model (zero fake products or fake reviews).

const prisma = require('../config/prisma');
const { generateProductSeo, slugify } = require('./productSeoGenerator');

const GLOBAL_SEO_SETTING_KEY = 'seo_global_settings';
const BLOG_POSTS_SETTING_KEY = 'seo_blogs';
const CATEGORY_EXT_SETTING_KEY = 'seo_category_extensions';

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
      posts = record.data;
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
    prisma.product.findMany({
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
    }),
    prisma.category.findMany({
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
    }),
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

module.exports = {
  DEFAULT_GLOBAL_SEO_SETTINGS,
  INITIAL_BLOG_POSTS,
  getGlobalSeoSettings,
  updateGlobalSeoSettings,
  getAllBlogPosts,
  getBlogPostBySlug,
  createOrUpdateBlogPost,
  deleteBlogPost,
  getCategorySeoExtensions,
  saveCategorySeoExtension,
  runComprehensiveSeoAudit
};

