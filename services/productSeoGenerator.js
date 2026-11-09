// SBF Florist - Product & Category SEO Generation Engine
// Implements Competitor-Informed Keyword Clustering, Dynamic Title/Description/Slug Generation,
// Keyword Density & On-Page SEO Scoring, and Search Intent Analysis.

const BRAND_NAME = 'Spring Blossoms Florist';
const SHORT_BRAND = 'SBFlorist Hyderabad';
const PRIMARY_LOCATION = 'Hyderabad';

// Clean text for SEO
const cleanText = (str) => {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

// Generate clean URL slug
const slugify = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Detect primary flower type or product category intent
const detectProductIntent = (product) => {
  const name = (product.name || product.title || '').toLowerCase();
  const desc = (product.description || product.shortDescription || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const tags = Array.isArray(product.tags) ? product.tags.map(t => String(t).toLowerCase()).join(' ') : '';
  const combined = `${name} ${desc} ${category} ${tags}`;

  const isRose = combined.includes('rose');
  const isCake = combined.includes('cake') || category === 'cakes';
  const isCombo = combined.includes('combo') || category === 'combos' || (isRose && isCake);
  const isLily = combined.includes('lil') || combined.includes('asiatic') || combined.includes('oriental');
  const isSunflower = combined.includes('sunflower');
  const isOrchid = combined.includes('orchid');
  const isCarnation = combined.includes('carnation');
  const isHamper = combined.includes('hamper') || combined.includes('basket');
  const isChocolate = combined.includes('chocolate') || combined.includes('ferrero') || combined.includes('cadbury');
  const isValentine = combined.includes('valentine') || combined.includes('romantic') || combined.includes('love') || product.isValentineProduct;
  const isBirthday = combined.includes('birthday');
  const isAnniversary = combined.includes('anniversary');

  let type = 'Flower Bouquet';
  if (isCombo) type = 'Flower & Cake Combo';
  else if (isCake) type = 'Celebration Cake';
  else if (isRose) type = 'Rose Bouquet';
  else if (isLily) type = 'Lily Arrangement';
  else if (isSunflower) type = 'Sunflower Bouquet';
  else if (isOrchid) type = 'Exotic Orchid Bouquet';
  else if (isCarnation) type = 'Carnation Bouquet';
  else if (isHamper) type = 'Luxury Gift Hamper';
  else if (isChocolate) type = 'Chocolate Gift Hamper';

  return {
    type,
    isRose,
    isCake,
    isCombo,
    isLily,
    isSunflower,
    isHamper,
    isValentine,
    isBirthday,
    isAnniversary
  };
};

// Generate complete SEO metadata for a single product
const generateProductSeo = (product, existingSeo = null) => {
  const name = cleanText(product.name || product.title || 'Handcrafted Arrangement');
  const intent = detectProductIntent(product);
  const rawPrice = Number(product.price) || 0;
  const priceStr = rawPrice > 0 ? `₹${Math.round(rawPrice)}` : '';

  // 1. Focus Keyword Selection
  let focusKeyword = '';
  if (intent.isValentine) {
    if (intent.isRose) focusKeyword = `${name} for Valentine's Day`;
    else if (intent.isCombo) focusKeyword = 'Valentine\'s Day Rose & Cake Combo';
    else focusKeyword = `${name} Valentine's Gift`;
  } else if (intent.isCombo) {
    focusKeyword = `${name} Flower and Cake Combo`;
  } else if (intent.isRose) {
    focusKeyword = `${name} Online`;
  } else if (intent.isCake) {
    focusKeyword = `${name} Delivery in Hyderabad`;
  } else if (intent.isBirthday) {
    focusKeyword = `${name} Birthday Flower Delivery`;
  } else if (intent.isAnniversary) {
    focusKeyword = `${name} Anniversary Gift`;
  } else {
    focusKeyword = `${name} Hyderabad Delivery`;
  }
  // Keep focus keyword concise and natural (max 4-5 words)
  focusKeyword = focusKeyword.replace(/\s+/g, ' ').trim();

  // 2. Secondary Keywords Cluster
  const secondaryKeywords = [];
  if (intent.isRose) {
    secondaryKeywords.push('Buy Red Roses Online', 'Rose Bouquet Hyderabad', 'Fresh Rose Bouquet Delivery', 'Romantic Rose Bouquet');
    if (intent.isValentine) secondaryKeywords.push('Valentine\'s Day Rose Bouquet', 'Valentine\'s Roses Hyderabad');
  } else if (intent.isCombo) {
    secondaryKeywords.push('Cake and Flower Combo', 'Birthday Cake and Bouquet', 'Flower and Cake Delivery Hyderabad', 'Surprise Gift Delivery Hyderabad');
    if (intent.isValentine) secondaryKeywords.push('Valentine\'s Day Gift Combos', 'Romantic Rose and Cake Combo');
  } else if (intent.isCake) {
    secondaryKeywords.push('Order Cakes Online Hyderabad', 'Fresh Bakery Cake Delivery', 'Same Day Cake Delivery', 'Midnight Cake Surprise');
  } else if (intent.isLily) {
    secondaryKeywords.push('Lily Flower Bouquet Online', 'Fresh Asiatic Lilies Hyderabad', 'Fragrant Lily Arrangements', 'Best Florist in Hyderabad');
  } else if (intent.isSunflower) {
    secondaryKeywords.push('Sunflower Bouquets Online', 'Fresh Sunflowers Hyderabad', 'Yellow Flower Arrangements', 'Same Day Flower Delivery');
  } else {
    secondaryKeywords.push('Online Flower Delivery Hyderabad', 'Fresh Flower Bouquets', 'Best Florist in Hyderabad', 'Same Day Flower Delivery Hyderabad');
  }

  // 3. SEO Title (Target: 45–60 characters)
  // Format: [Product Name] Online | SBFlorist Hyderabad
  let seoTitle = `${name} Online | ${SHORT_BRAND}`;
  if (seoTitle.length > 60) {
    seoTitle = `${name} | ${SHORT_BRAND}`;
  }
  if (seoTitle.length > 60) {
    const truncatedName = name.slice(0, 60 - ` | ${SHORT_BRAND}`.length - 3) + '...';
    seoTitle = `${truncatedName} | ${SHORT_BRAND}`;
  }

  // 4. Meta Description (Target: 130–160 characters)
  let descDetail = '';
  if (intent.isCombo) {
    descDetail = `handcrafted ${intent.type.toLowerCase()} featuring fresh blooms and a delectable bakery cake`;
  } else if (intent.isRose) {
    descDetail = 'farm-fresh Dutch roses carefully hand-tied by expert florists';
  } else if (intent.isCake) {
    descDetail = 'freshly baked artisan celebration cake crafted with premium ingredients';
  } else {
    descDetail = `vibrant handcrafted ${intent.type.toLowerCase()} arranged fresh for your special moments`;
  }

  let metaDescription = `Order ${name} online from Spring Blossoms Florist. Enjoy ${descDetail} with express same-day and midnight delivery in Hyderabad.`;
  if (metaDescription.length > 160) {
    metaDescription = `Order ${name} online from Spring Blossoms Florist. Handcrafted ${intent.type.toLowerCase()} with same-day and midnight delivery in Hyderabad.`;
  }
  if (metaDescription.length > 160) {
    metaDescription = metaDescription.slice(0, 157).trim() + '...';
  }

  // 5. Slug
  const slug = slugify(product.slug || product.name || product.title);

  // 6. Product-specific H1
  const h1 = name;

  // 7. Image Alt Text
  const imageAlt = `${name} - Handcrafted ${intent.type} flower delivery in Hyderabad`;

  // 8. Canonical URL
  const canonicalUrl = `https://sbflorist.in/product/${product.id || product._id || slug}`;

  // Preserve manual edits if they exist
  const isManual = existingSeo?.isManual === true;
  const result = {
    focusKeyword: (isManual && existingSeo?.focusKeyword) ? existingSeo.focusKeyword : focusKeyword,
    secondaryKeywords: (isManual && existingSeo?.secondaryKeywords) ? existingSeo.secondaryKeywords : secondaryKeywords,
    seoTitle: (isManual && (existingSeo?.seoTitle || existingSeo?.metaTitle)) ? (existingSeo.seoTitle || existingSeo.metaTitle) : seoTitle,
    metaDescription: (isManual && (existingSeo?.seoDescription || existingSeo?.metaDescription)) ? (existingSeo.seoDescription || existingSeo.metaDescription) : metaDescription,
    slug: (isManual && existingSeo?.slug) ? existingSeo.slug : slug,
    h1: (isManual && existingSeo?.h1) ? existingSeo.h1 : h1,
    imageAlt: (isManual && existingSeo?.imageAlt) ? existingSeo.imageAlt : imageAlt,
    canonicalUrl: (isManual && existingSeo?.canonicalUrl) ? existingSeo.canonicalUrl : canonicalUrl,
    noindex: isManual ? Boolean(existingSeo?.noindex) : false,
    ogImage: existingSeo?.ogImage || (product.images && product.images[0]?.url ? product.images[0].url : (Array.isArray(product.images) && typeof product.images[0] === 'string' ? product.images[0] : '')),
    isManual
  };

  // 9. Calculate SEO Score & Warnings
  const analysis = evaluateSeoScore({
    ...result,
    productName: name,
    description: product.description || product.shortDescription || ''
  });

  result.score = analysis.score;
  result.warnings = analysis.warnings;
  result.passed = analysis.passed;

  return result;
};

// Evaluate SEO Quality Score (0–100) and identify missing on-page factors
const evaluateSeoScore = (data) => {
  let score = 0;
  const warnings = [];
  const passed = [];

  const focus = (data.focusKeyword || '').toLowerCase().trim();
  const title = (data.seoTitle || '').toLowerCase().trim();
  const desc = (data.metaDescription || '').toLowerCase().trim();
  const h1 = (data.h1 || data.productName || '').toLowerCase().trim();
  const alt = (data.imageAlt || '').toLowerCase().trim();
  const content = (data.description || '').toLowerCase().trim();

  // 1. Focus Keyword presence in Title (+20)
  if (focus && title.includes(focus)) {
    score += 20;
    passed.push('Focus keyword is present in the SEO Title.');
  } else if (focus) {
    const focusWords = focus.split(/\s+/).filter(w => w.length > 3);
    const matchCount = focusWords.filter(w => title.includes(w)).length;
    if (matchCount >= Math.ceil(focusWords.length * 0.6)) {
      score += 12;
      passed.push('Key parts of the focus keyword appear in the SEO Title.');
    } else {
      warnings.push('Focus keyword is missing from the SEO Title.');
    }
  } else {
    warnings.push('No primary focus keyword defined.');
  }

  // 2. Focus Keyword in Meta Description (+20)
  if (focus && desc.includes(focus)) {
    score += 20;
    passed.push('Focus keyword is present in the Meta Description.');
  } else if (focus) {
    const focusWords = focus.split(/\s+/).filter(w => w.length > 3);
    const matchCount = focusWords.filter(w => desc.includes(w)).length;
    if (matchCount >= Math.ceil(focusWords.length * 0.6)) {
      score += 12;
      passed.push('Key parts of the focus keyword appear in the Meta Description.');
    } else {
      warnings.push('Focus keyword is missing from the Meta Description.');
    }
  }

  // 3. Focus Keyword in H1 (+15)
  if (focus && h1.includes(focus)) {
    score += 15;
    passed.push('Focus keyword is included in the primary H1 heading.');
  } else if (focus) {
    const focusWords = focus.split(/\s+/).filter(w => w.length > 3);
    const matchCount = focusWords.filter(w => h1.includes(w)).length;
    if (matchCount >= Math.ceil(focusWords.length * 0.5)) {
      score += 10;
      passed.push('Heading H1 naturally matches focus keyword topic.');
    } else {
      warnings.push('H1 does not reflect the focus keyword.');
    }
  }

  // 4. SEO Title Length (+15)
  const titleLen = (data.seoTitle || '').length;
  if (titleLen >= 35 && titleLen <= 60) {
    score += 15;
    passed.push(`SEO Title length (${titleLen} chars) is optimal (35–60 characters).`);
  } else if (titleLen > 60) {
    score += 5;
    warnings.push(`SEO Title is too long (${titleLen} chars). Google may truncate it (aim for ≤60 chars).`);
  } else if (titleLen > 0 && titleLen < 35) {
    score += 5;
    warnings.push(`SEO Title is short (${titleLen} chars). Expand to capture high-intent searches.`);
  } else {
    warnings.push('SEO Title is missing.');
  }

  // 5. Meta Description Length (+15)
  const descLen = (data.metaDescription || '').length;
  if (descLen >= 120 && descLen <= 160) {
    score += 15;
    passed.push(`Meta Description length (${descLen} chars) is optimal (120–160 characters).`);
  } else if (descLen > 160) {
    score += 8;
    warnings.push(`Meta Description is too long (${descLen} chars). Google may truncate beyond 160 characters.`);
  } else if (descLen > 0 && descLen < 120) {
    score += 6;
    warnings.push(`Meta Description is short (${descLen} chars). Enrich it with delivery details (aim for 120–160).`);
  } else {
    warnings.push('Meta Description is missing.');
  }

  // 6. Image Alt Text (+10)
  if (alt && alt.length >= 10) {
    score += 10;
    passed.push('Descriptive image alt text is configured for image search indexing.');
  } else {
    warnings.push('Image alt text is missing or too short.');
  }

  // 7. Product Content Depth (+5)
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  if (wordCount >= 30) {
    score += 5;
    passed.push(`Product description has sufficient content depth (${wordCount} words).`);
  } else {
    warnings.push('Product content is thin (<30 words). Consider adding flower care and packaging details.');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    warnings,
    passed
  };
};

// Generate dynamic Valentine's Week calendar dates for any specified or current year
const getValentineWeekCalendar = (targetYear) => {
  const current = new Date();
  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth(); // 0-indexed: 1 = February
  const currentDate = current.getDate();

  // If no year specified, compute next active Valentine season
  let year = targetYear;
  if (!year) {
    if (currentMonth > 1 || (currentMonth === 1 && currentDate > 14)) {
      year = currentYear + 1;
    } else {
      year = currentYear;
    }
  }

  const days = [
    {
      id: 'rose-day',
      name: 'Rose Day',
      dayNumber: 7,
      dateString: `${year}-02-07`,
      keyword: 'Rose Day Flowers',
      secondaryKeyword: 'Rose Day Gifts',
      heading: 'Rose Day Gifts & Fresh Rose Bouquets',
      description: `Express your heartfelt romance on Rose Day with handcrafted Dutch red roses, blushing pink stems, and radiant yellow bouquets from Spring Blossoms Florist. Enjoy same-day doorstep delivery across Hyderabad.`,
      icon: '🌹',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'roses'
    },
    {
      id: 'propose-day',
      name: 'Propose Day',
      dayNumber: 8,
      dateString: `${year}-02-08`,
      keyword: 'Propose Day Gifts',
      secondaryKeyword: 'Propose Day Flowers',
      heading: 'Propose Day Gifts & Romantic Surprises',
      description: `Make your confession unforgettable on Propose Day with luxury long-stem roses, exotic orchids, and decadent celebration cakes hand-delivered with midnight precision anywhere in Hyderabad and Secunderabad.`,
      icon: '💍',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'combos'
    },
    {
      id: 'chocolate-day',
      name: 'Chocolate Day',
      dayNumber: 9,
      dateString: `${year}-02-09`,
      keyword: 'Chocolate Day Gifts',
      secondaryKeyword: 'Chocolate Day Combos',
      heading: 'Chocolate Day Gifts & Sweet Surprises',
      description: `Celebrate sweet affection on Chocolate Day with gourmet Ferrero Rocher arrangements, Cadbury hampers, and rich Dutch Truffle cakes paired with farm-fresh blossoms by Hyderabad's premier floral studio.`,
      icon: '🍫',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'combos'
    },
    {
      id: 'teddy-day',
      name: 'Teddy Day',
      dayNumber: 10,
      dateString: `${year}-02-10`,
      keyword: 'Teddy Day Gifts',
      secondaryKeyword: 'Teddy Bear and Flowers',
      heading: 'Teddy Day Gifts & Cuddly Combos',
      description: `Send adorable cuddles on Teddy Day with plush teddy bears paired with romantic pink rose bouquets and handwritten message cards delivered safely to your loved one’s doorstep in Hyderabad.`,
      icon: '🧸',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'combos'
    },
    {
      id: 'promise-day',
      name: 'Promise Day',
      dayNumber: 11,
      dateString: `${year}-02-11`,
      keyword: 'Promise Day Gifts',
      secondaryKeyword: 'Promise Day Flowers',
      heading: 'Promise Day Gifts & Meaningful Bouquets',
      description: `Seal lifelong commitments on Promise Day with pristine white lilies, vibrant mixed carnations, and elegant flower boxes symbolizing everlasting loyalty and devotion across the Twin Cities.`,
      icon: '🤝',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'bouquets'
    },
    {
      id: 'hug-day',
      name: 'Hug Day',
      dayNumber: 12,
      dateString: `${year}-02-12`,
      keyword: 'Hug Day Gifts',
      secondaryKeyword: 'Warm Hug Day Flowers',
      heading: 'Hug Day Gifts & Warm Floral Bundles',
      description: `Wrap your sweetheart in floral warmth on Hug Day with generous 50-stem rose arrangements, soothing sunflowers, and comforting sweet bundles crafted with love at our Mehdipatnam design studio.`,
      icon: '🤗',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'bouquets'
    },
    {
      id: 'kiss-day',
      name: 'Kiss Day',
      dayNumber: 13,
      dateString: `${year}-02-13`,
      keyword: 'Kiss Day Gifts',
      secondaryKeyword: 'Romantic Kiss Day Flowers',
      heading: 'Kiss Day Gifts & Romantic Floral Creations',
      description: `Ignite passionate sparks on Kiss Day with velvety crimson roses, heart-shaped floral boxes, and luxury gift hampers scheduled for midnight delivery right before Valentine's Day.`,
      icon: '💋',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'roses'
    },
    {
      id: 'valentines-day',
      name: 'Valentine\'s Day',
      dayNumber: 14,
      dateString: `${year}-02-14`,
      keyword: 'Valentine\'s Day Gifts',
      secondaryKeyword: 'Valentine\'s Day Flowers Hyderabad',
      heading: 'Valentine\'s Day Gifts & Grand Luxury Rose Bouquets',
      description: `The grand crescendo of love! Celebrate Valentine's Day with signature 100-rose presentations, heart-shaped Red Velvet cakes, and personalized romantic gift hampers delivered across 50+ Hyderabad localities.`,
      icon: '❤️',
      bannerImage: '/images/hero-flower-shop.jpg',
      targetCategory: 'roses'
    }
  ];

  return days.map(day => {
    const d = new Date(year, 1, day.dayNumber);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = `${weekday}, Feb ${day.dayNumber}, ${year}`;
    return {
      ...day,
      year,
      weekday,
      formattedDate
    };
  });
};

module.exports = {
  cleanText,
  slugify,
  detectProductIntent,
  generateProductSeo,
  evaluateSeoScore,
  getValentineWeekCalendar,
  BRAND_NAME,
  SHORT_BRAND,
  PRIMARY_LOCATION
};

