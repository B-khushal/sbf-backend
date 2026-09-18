const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const prisma = require('../config/prisma');
const asyncHandler = require('express-async-handler');

// In-memory cache for ultra-fast response times (<50ms for frequent queries)
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const item = searchCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (searchCache.size > 2000) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  searchCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function clearSearchCache() {
  searchCache.clear();
}

// Florist vocabularies
const FLOWER_TYPES = [
  'rose', 'roses', 'lily', 'lilies', 'orchid', 'orchids', 'sunflower', 'sunflowers',
  'tulip', 'tulips', 'carnation', 'carnations', 'gerbera', 'gerberas', 'anthurium',
  'daisy', 'daisies', 'hydrangea', 'hydrangeas', 'chrysanthemum', 'peony', 'peonies',
  'mixed', 'exotic'
];

const COLOR_NAMES = [
  'red', 'pink', 'white', 'yellow', 'purple', 'blue', 'orange',
  'peach', 'gold', 'crimson', 'violet', 'lavender', 'magenta', 'green'
];

const OCCASIONS = [
  'birthday', 'anniversary', 'wedding', 'marriage', 'valentine', 'valentines',
  'love', 'romantic', 'romance', 'sympathy', 'funeral', 'condolence',
  'congratulations', 'corporate', 'baby shower', 'housewarming', 'thank you',
  'get well soon', 'sorry', 'mothers day', 'fathers day', 'rakhi', 'diwali', 'new year'
];

const RECIPIENT_TYPES = [
  'wife', 'husband', 'girlfriend', 'boyfriend', 'mother', 'mom', 'father', 'dad',
  'friend', 'friends', 'sister', 'brother', 'parents', 'couple', 'him', 'her', 'client'
];

const PRODUCT_KEYWORDS = [
  'luxury', 'premium', 'bouquet', 'bouquets', 'box', 'basket', 'bunch',
  'vase', 'combo', 'hamper', 'fresh', 'imported', 'special'
];

// Florist-specific common typos dictionary
const TYPO_MAP = {
  'roes': 'roses',
  'rose': 'roses',
  'rosess': 'roses',
  'rosez': 'roses',
  'bouqet': 'bouquet',
  'buquet': 'bouquet',
  'boquet': 'bouquet',
  'boqet': 'bouquet',
  'buket': 'bouquet',
  'bouquets': 'bouquet',
  'aniversery': 'anniversary',
  'aniversary': 'anniversary',
  'anniversery': 'anniversary',
  'aniversy': 'anniversary',
  'flowrs': 'flowers',
  'flowes': 'flowers',
  'floers': 'flowers',
  'folwers': 'flowers',
  'flwers': 'flowers',
  'flower': 'flowers',
  'orkid': 'orchid',
  'orchd': 'orchid',
  'orchids': 'orchid',
  'sunflowr': 'sunflower',
  'sunflowrs': 'sunflower',
  'tullip': 'tulip',
  'tullips': 'tulip',
  'carnatn': 'carnation',
  'carnashun': 'carnation',
  'gerbra': 'gerbera',
  'garbera': 'gerbera',
  'hydranga': 'hydrangea',
  'choclate': 'chocolate',
  'chocolat': 'chocolate',
  'choclates': 'chocolate',
  'valintine': 'valentine',
  'valentins': 'valentine',
  'bithday': 'birthday',
  'bday': 'birthday',
  'birhday': 'birthday'
};

// Florist synonyms dictionary
const SYNONYM_MAP = {
  'flowers': ['bouquet', 'floral', 'roses', 'blooms'],
  'bouquet': ['flowers', 'bunch', 'roses bouquet', 'floral arrangement'],
  'roses': ['rose bouquet', 'flowers', 'red roses', 'romantic flowers'],
  'rose bouquet': ['roses', 'red roses', 'romantic flowers', 'love bouquet'],
  'birthday gift': ['birthday flowers', 'birthday cake', 'birthday bouquet', 'birthday combos'],
  'birthday flowers': ['birthday bouquet', 'birthday gift', 'birthday combos'],
  'romantic': ['love flowers', 'red roses', 'rose bouquet', 'valentine', 'anniversary flowers'],
  'love flowers': ['romantic', 'red roses', 'rose bouquet', 'anniversary'],
  'red roses': ['romantic', 'rose bouquet', 'love flowers', 'roses'],
  'yellow bouquet': ['sunflower', 'yellow roses', 'sunflowers bouquet'],
  'luxury flowers': ['premium roses', 'exotic orchids', 'luxury bouquet'],
  'premium roses': ['luxury flowers', 'red roses', 'long stem roses'],
  'wife': ['romantic', 'love flowers', 'red roses', 'anniversary gifts', 'women'],
  'husband': ['love', 'romantic', 'men gifts', 'anniversary'],
  'girlfriend': ['romantic', 'love flowers', 'red roses', 'teddy', 'chocolates'],
  'boyfriend': ['gifts', 'chocolates', 'plants'],
  'mother': ['mothers day', 'carnations', 'lilies', 'pink roses', 'mom'],
  'mom': ['mothers day', 'carnations', 'lilies', 'mother'],
  'father': ['fathers day', 'plants', 'orchids', 'dad'],
  'dad': ['fathers day', 'plants', 'orchids', 'father'],
  'gift': ['hamper', 'combo', 'bouquet', 'chocolate'],
  'box': ['flower box', 'rose box', 'luxury box'],
  'basket': ['flower basket', 'fruit basket', 'chocolate basket']
};

// Damerau-Levenshtein distance for typo tolerance
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return dp[m][n];
}

// Normalize and correct typos in query
function normalizeAndExpandQuery(rawQuery) {
  if (!rawQuery) return { cleanedQuery: '', terms: [], expandedTerms: [], correctedQuery: '' };

  const cleaned = rawQuery.toLowerCase().trim().replace(/['"]/g, '');
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const correctedTokens = tokens.map(token => {
    if (TYPO_MAP[token]) return TYPO_MAP[token];
    // Check if token matches any known flower/occasion/color with distance <= 1 or 2
    const allKnown = [...FLOWER_TYPES, ...COLOR_NAMES, ...OCCASIONS, ...PRODUCT_KEYWORDS, ...RECIPIENT_TYPES];
    for (let word of allKnown) {
      if (Math.abs(word.length - token.length) <= 2) {
        const dist = levenshteinDistance(token, word);
        if (dist <= 1 || (token.length >= 6 && dist <= 2)) {
          return word;
        }
      }
    }
    return token;
  });

  const correctedQuery = correctedTokens.join(' ');

  // Collect synonyms
  const synonyms = new Set();
  // Check exact phrase synonym
  if (SYNONYM_MAP[cleaned]) {
    SYNONYM_MAP[cleaned].forEach(s => synonyms.add(s));
  }
  if (SYNONYM_MAP[correctedQuery]) {
    SYNONYM_MAP[correctedQuery].forEach(s => synonyms.add(s));
  }

  // Check token-level synonyms
  correctedTokens.forEach(token => {
    if (SYNONYM_MAP[token]) {
      SYNONYM_MAP[token].forEach(s => synonyms.add(s));
    }
  });

  const expandedTerms = Array.from(new Set([...tokens, ...correctedTokens, ...synonyms]));

  return {
    cleanedQuery: cleaned,
    correctedQuery,
    terms: correctedTokens,
    expandedTerms
  };
}

// Extract product metadata attributes for scoring and filtering
function extractProductAttributes(product) {
  const text = [
    product.title || product.name || '',
    product.description || '',
    product.shortDescription || '',
    product.category || '',
    product.subcategory || '',
    ...(Array.isArray(product.categories) ? product.categories : []),
    ...(Array.isArray(product.tags) ? product.tags.map(t => typeof t === 'string' ? t : t.tag || '') : []),
    ...(Array.isArray(product.occasions) ? product.occasions : [])
  ].join(' ').toLowerCase();

  const flowers = FLOWER_TYPES.filter(f => text.includes(f));
  const colors = COLOR_NAMES.filter(c => text.includes(c));
  const occasions = OCCASIONS.filter(o => text.includes(o));
  const recipients = RECIPIENT_TYPES.filter(r => text.includes(r));

  return {
    flowers,
    colors,
    occasions,
    recipients,
    fullText: text
  };
}

/**
 * Score a product against a search query according to enterprise priority rules:
 * 1. Exact Product Name Match: 1000
 * 2. Product Name Starts With / Contains Query: 800 / 600
 * 3. Product Tags Match: 500
 * 4. Category & Subcategory Match: 400
 * 5. Flower Type / Color / Occasion / Recipient: 350
 * 6. SKU match: 300
 * 7. Description Match: 150
 * 8. Synonym / Expanded Terms: 100
 * 9. Fuzzy match: 50
 * Plus popularity boost: rating * 15 + isBestseller (50) + isFeatured (30)
 */
function scoreProduct(product, queryObj) {
  const { cleanedQuery, correctedQuery, terms, expandedTerms } = queryObj;
  const title = (product.title || product.name || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const sku = (product.sku || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const subcategory = (product.subcategory || '').toLowerCase();
  const categories = Array.isArray(product.categories) ? product.categories.map(c => String(c).toLowerCase()) : [];
  const tags = Array.isArray(product.tags) ? product.tags.map(t => (typeof t === 'string' ? t : t.tag || '').toLowerCase()) : [];

  let score = 0;
  let matchFound = false;

  // 1. Exact Product Name Match
  if (title === cleanedQuery || title === correctedQuery) {
    score += 1000;
    matchFound = true;
  }
  // 2. Product Name starts with query
  else if (title.startsWith(cleanedQuery) || title.startsWith(correctedQuery)) {
    score += 800;
    matchFound = true;
  }
  // 2b. Product Name contains whole query
  else if (title.includes(cleanedQuery) || title.includes(correctedQuery)) {
    score += 600;
    matchFound = true;
  }

  // Check terms in title
  const matchingTermsInTitle = terms.filter(t => title.includes(t));
  if (matchingTermsInTitle.length > 0) {
    score += (matchingTermsInTitle.length / terms.length) * 400;
    matchFound = true;
  }

  // 3. Product Tags Match
  const tagMatch = tags.some(tag => tag === cleanedQuery || tag === correctedQuery || terms.some(t => tag.includes(t)));
  if (tagMatch) {
    score += 500;
    matchFound = true;
  }

  // 4. Category & Subcategory Match
  if (category === cleanedQuery || category === correctedQuery || subcategory === cleanedQuery || subcategory === correctedQuery) {
    score += 400;
    matchFound = true;
  } else if (category.includes(cleanedQuery) || subcategory.includes(cleanedQuery)) {
    score += 250;
    matchFound = true;
  } else if (categories.some(c => c === cleanedQuery || c === correctedQuery || terms.some(t => c.includes(t)))) {
    score += 300;
    matchFound = true;
  }

  // 5. Flower Type, Color, Occasion, Recipient Match
  const attrs = extractProductAttributes(product);
  for (let term of terms) {
    if (attrs.flowers.includes(term)) { score += 350; matchFound = true; }
    if (attrs.colors.includes(term)) { score += 300; matchFound = true; }
    if (attrs.occasions.includes(term)) { score += 350; matchFound = true; }
    if (attrs.recipients.includes(term)) { score += 350; matchFound = true; }
  }

  // 6. SKU Match
  if (sku && (sku === cleanedQuery || sku.includes(cleanedQuery))) {
    score += 300;
    matchFound = true;
  }

  // 7. Description Match
  if (description.includes(cleanedQuery) || description.includes(correctedQuery)) {
    score += 150;
    matchFound = true;
  } else {
    const descMatches = terms.filter(t => description.includes(t));
    if (descMatches.length > 0) {
      score += (descMatches.length / terms.length) * 100;
      matchFound = true;
    }
  }

  // 8. Synonym / Expanded Terms Match
  for (let exp of expandedTerms) {
    if (exp !== cleanedQuery && exp !== correctedQuery) {
      if (title.includes(exp)) { score += 200; matchFound = true; }
      else if (category.includes(exp) || categories.includes(exp)) { score += 150; matchFound = true; }
      else if (attrs.fullText.includes(exp)) { score += 100; matchFound = true; }
    }
  }

  // 9. Fuzzy Typo Match (if no direct match on title yet)
  if (!matchFound && cleanedQuery.length >= 3) {
    const titleWords = title.split(/\s+/);
    for (let word of titleWords) {
      if (Math.abs(word.length - cleanedQuery.length) <= 2) {
        const dist = levenshteinDistance(word, cleanedQuery);
        if (dist <= 1 || (cleanedQuery.length >= 6 && dist <= 2)) {
          score += 50;
          matchFound = true;
          break;
        }
      }
    }
  }

  // Product Quality / Popularity Boosters
  if (matchFound) {
    if (product.rating && product.rating > 0) score += product.rating * 15;
    if (product.isBestseller) score += 50;
    if (product.isFeatured) score += 30;
    if (product.isNewArrival || product.isNew) score += 20;
    if ((product.stock || product.countInStock) > 0) score += 40; // in-stock products rank higher
  }

  return { score, matchFound, attrs };
}

// @desc Smart Enterprise Search with filters, typo tolerance, synonyms, and ranking
// @route GET /api/search
// @access Public
const searchProducts = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const {
    q = '',
    category,
    flowerType,
    occasion,
    color,
    minPrice,
    maxPrice,
    inStock,
    sameDay,
    isBestseller,
    isNewArrival,
    sort = 'relevance',
    page = 1,
    limit = 40
  } = req.query;

  const cacheKey = `search:${JSON.stringify(req.query)}`;
  const cachedResponse = getCached(cacheKey);
  if (cachedResponse) {
    return res.json({
      ...cachedResponse,
      responseTimeMs: Date.now() - startTime,
      fromCache: true
    });
  }

  // 1. Fetch base active/published products
  const products = await Product.find({
    hidden: false,
    approvalStatus: { $in: ['approved', null] }
  });

  const queryObj = normalizeAndExpandQuery(q);

  let scoredItems = [];

  for (let product of products) {
    const prodObj = product.toObject ? product.toObject() : product;
    let score = 0;
    let matchFound = true;
    const attrs = extractProductAttributes(prodObj);

    if (queryObj.cleanedQuery) {
      const scoring = scoreProduct(prodObj, queryObj);
      score = scoring.score;
      matchFound = scoring.matchFound;
    }

    if (!matchFound) continue;

    // Apply Faceted Filters
    // Category filter
    if (category && category !== 'all') {
      const targetCat = category.toLowerCase().trim();
      const pCat = (prodObj.category || '').toLowerCase();
      const pSub = (prodObj.subcategory || '').toLowerCase();
      const pCats = Array.isArray(prodObj.categories) ? prodObj.categories.map(c => String(c).toLowerCase()) : [];
      if (pCat !== targetCat && pSub !== targetCat && !pCats.includes(targetCat)) {
        continue;
      }
    }

    // Flower type filter
    if (flowerType && flowerType !== 'all') {
      const targetFlower = flowerType.toLowerCase().trim();
      if (!attrs.flowers.includes(targetFlower) && !attrs.fullText.includes(targetFlower)) {
        continue;
      }
    }

    // Occasion filter
    if (occasion && occasion !== 'all') {
      const targetOccasion = occasion.toLowerCase().trim();
      if (!attrs.occasions.includes(targetOccasion) && !attrs.fullText.includes(targetOccasion)) {
        continue;
      }
    }

    // Color filter
    if (color && color !== 'all') {
      const targetColor = color.toLowerCase().trim();
      if (!attrs.colors.includes(targetColor) && !attrs.fullText.includes(targetColor)) {
        continue;
      }
    }

    // Price range filter
    const price = Number(prodObj.price || 0);
    if (minPrice !== undefined && price < Number(minPrice)) continue;
    if (maxPrice !== undefined && price > Number(maxPrice)) continue;

    // In Stock filter
    if (inStock === 'true' || inStock === true) {
      const stock = Number(prodObj.stock !== undefined ? prodObj.stock : prodObj.countInStock || 0);
      if (stock <= 0 || prodObj.isAvailable === false) continue;
    }

    // Same Day Delivery filter
    if (sameDay === 'true' || sameDay === true) {
      if (prodObj.sameDay === false || prodObj.isSameDay === false) continue;
    }

    // Bestseller filter
    if (isBestseller === 'true' || isBestseller === true) {
      if (!prodObj.isBestseller) continue;
    }

    // New Arrival filter
    if (isNewArrival === 'true' || isNewArrival === true) {
      if (!prodObj.isNewArrival && !prodObj.isNew) continue;
    }

    scoredItems.push({
      product: prodObj,
      score,
      flowerTypes: attrs.flowers,
      colors: attrs.colors,
      occasions: attrs.occasions
    });
  }

  // 2. Sorting
  if (sort === 'relevance' || !sort) {
    scoredItems.sort((a, b) => b.score - a.score);
  } else if (sort === 'price-asc') {
    scoredItems.sort((a, b) => Number(a.product.price) - Number(b.product.price));
  } else if (sort === 'price-desc') {
    scoredItems.sort((a, b) => Number(b.product.price) - Number(a.product.price));
  } else if (sort === 'newest') {
    scoredItems.sort((a, b) => new Date(b.product.createdAt || 0) - new Date(a.product.createdAt || 0));
  } else if (sort === 'rating') {
    scoredItems.sort((a, b) => Number(b.product.rating || 0) - Number(a.product.rating || 0));
  }

  const total = scoredItems.length;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedResults = scoredItems.slice(startIndex, startIndex + limitNum).map(item => ({
    ...item.product,
    searchScore: item.score,
    flowerTypes: item.flowerTypes,
    colors: item.colors,
    occasions: item.occasions
  }));

  // Generate dynamic facets for UI filters
  const facets = {
    flowerTypes: {},
    colors: {},
    occasions: {},
    categories: {},
    priceRange: { min: 0, max: 0 }
  };

  let minP = Infinity;
  let maxP = 0;
  scoredItems.forEach(({ product, flowerTypes, colors, occasions }) => {
    flowerTypes.forEach(f => { facets.flowerTypes[f] = (facets.flowerTypes[f] || 0) + 1; });
    colors.forEach(c => { facets.colors[c] = (facets.colors[c] || 0) + 1; });
    occasions.forEach(o => { facets.occasions[o] = (facets.occasions[o] || 0) + 1; });
    if (product.category) facets.categories[product.category] = (facets.categories[product.category] || 0) + 1;
    const p = Number(product.price || 0);
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  });
  facets.priceRange.min = minP === Infinity ? 0 : minP;
  facets.priceRange.max = maxP;

  const responseData = {
    success: true,
    query: q,
    correctedQuery: queryObj.correctedQuery !== queryObj.cleanedQuery ? queryObj.correctedQuery : null,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    products: paginatedResults,
    facets,
    responseTimeMs: Date.now() - startTime
  };

  setCache(cacheKey, responseData);

  // Background logging (non-blocking) for analytics
  if (q && q.trim().length >= 2 && pageNum === 1) {
    setImmediate(async () => {
      try {
        await ActivityLog.create({
          action: 'search_query',
          actionType: total === 0 ? 'zero_results_search' : 'search_query',
          module: 'search',
          details: {
            query: q.trim(),
            correctedQuery: responseData.correctedQuery,
            resultsCount: total,
            category: category || null,
            ipAddress: req.ip || req.connection.remoteAddress || null,
            userAgent: req.headers['user-agent'] || null
          }
        });
      } catch (logErr) {
        console.error('Failed to log search event:', logErr.message);
      }
    });
  }

  return res.json(responseData);
});

// @desc Instant search suggestions (Autocomplete dropdown)
// @route GET /api/search/suggestions
// @access Public
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q = '' } = req.query;
  if (!q || q.trim().length < 1) {
    return res.json({ suggestions: [], categories: [], products: [] });
  }

  const queryObj = normalizeAndExpandQuery(q);
  const cacheKey = `suggestions:${queryObj.cleanedQuery}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const products = await Product.find({
    hidden: false,
    approvalStatus: { $in: ['approved', null] }
  });

  const matchingCategories = new Set();
  const matchingTerms = new Set();
  const scoredProducts = [];

  const lowerQ = queryObj.cleanedQuery;

  // Add matching flower types, colors, occasions
  FLOWER_TYPES.forEach(f => {
    if (f.startsWith(lowerQ) || f.includes(lowerQ)) matchingTerms.add(f);
  });
  OCCASIONS.forEach(o => {
    if (o.startsWith(lowerQ) || o.includes(lowerQ)) matchingTerms.add(o);
  });

  for (let product of products) {
    const prod = product.toObject ? product.toObject() : product;
    const title = (prod.title || prod.name || '').toLowerCase();
    const cat = (prod.category || '').toLowerCase();

    if (cat.includes(lowerQ)) {
      matchingCategories.add(prod.category);
    }
    if (Array.isArray(prod.categories)) {
      prod.categories.forEach(c => {
        if (String(c).toLowerCase().includes(lowerQ)) matchingCategories.add(c);
      });
    }

    if (title.startsWith(lowerQ)) {
      matchingTerms.add(prod.title || prod.name);
    }

    const { score, matchFound } = scoreProduct(prod, queryObj);
    if (matchFound) {
      scoredProducts.push({
        _id: prod._id || prod.id,
        id: prod.id || prod._id,
        title: prod.title || prod.name,
        name: prod.name || prod.title,
        price: Number(prod.price || 0),
        image: Array.isArray(prod.images) ? prod.images[0] : null,
        images: prod.images || [],
        category: prod.category,
        rating: prod.rating || 0,
        score
      });
    }
  }

  scoredProducts.sort((a, b) => b.score - a.score);

  const result = {
    query: q,
    correctedQuery: queryObj.correctedQuery !== queryObj.cleanedQuery ? queryObj.correctedQuery : null,
    categories: Array.from(matchingCategories).slice(0, 4),
    suggestions: Array.from(matchingTerms).slice(0, 6),
    products: scoredProducts.slice(0, 5)
  };

  setCache(cacheKey, result);
  return res.json(result);
});

// @desc Track search events (click-through or order conversion)
// @route POST /api/search/track
// @access Public / Optional Protect
const trackSearchEvent = asyncHandler(async (req, res) => {
  const {
    query,
    resultsCount,
    clickedProductId,
    clickedProductTitle,
    converted,
    orderId,
    orderTotal
  } = req.body;

  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const userId = req.user ? (req.user.id || req.user._id) : null;

  await ActivityLog.create({
    userId,
    action: converted ? 'search_conversion' : (clickedProductId ? 'search_click' : 'search_query'),
    actionType: converted ? 'search_conversion' : (resultsCount === 0 ? 'zero_results_search' : 'search_event'),
    module: 'search',
    details: {
      query: String(query).trim(),
      resultsCount: resultsCount !== undefined ? Number(resultsCount) : null,
      clickedProductId: clickedProductId || null,
      clickedProductTitle: clickedProductTitle || null,
      converted: Boolean(converted),
      orderId: orderId || null,
      orderTotal: orderTotal ? Number(orderTotal) : null
    },
    ipAddress: req.ip || req.connection.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null
  });

  return res.json({ success: true, message: 'Search event recorded' });
});

// @desc Popular Search Analytics for Admin Dashboard
// @route GET /api/search/analytics
// @access Private/Admin
const getSearchAnalytics = asyncHandler(async (req, res) => {
  const { timeframe = '30days' } = req.query;

  let dateLimit = new Date();
  if (timeframe === 'today') {
    dateLimit.setHours(0, 0, 0, 0);
  } else if (timeframe === '7days') {
    dateLimit.setDate(dateLimit.getDate() - 7);
  } else if (timeframe === '30days') {
    dateLimit.setDate(dateLimit.getDate() - 30);
  } else {
    dateLimit = new Date(0); // all time
  }

  // Query ActivityLogs where module = 'search'
  const logs = await ActivityLog.find({
    module: 'search',
    createdAt: { $gte: dateLimit }
  });

  const queryStats = new Map();
  const failedQueries = new Map();
  let totalSearches = 0;
  let totalConversions = 0;
  let totalSearchRevenue = 0;

  logs.forEach(log => {
    const details = log.details || {};
    const q = (details.query || '').trim().toLowerCase();
    if (!q) return;

    totalSearches++;
    const isZeroResults = log.actionType === 'zero_results_search' || details.resultsCount === 0;

    // Track query frequencies
    if (!queryStats.has(q)) {
      queryStats.set(q, {
        term: q,
        count: 0,
        resultsCount: details.resultsCount || 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        lastSearched: log.createdAt || log.timestamp
      });
    }
    const stat = queryStats.get(q);
    stat.count++;
    if (new Date(log.createdAt || log.timestamp) > new Date(stat.lastSearched)) {
      stat.lastSearched = log.createdAt || log.timestamp;
    }
    if (details.clickedProductId || log.action === 'search_click') stat.clicks++;
    if (details.converted || log.action === 'search_conversion') {
      stat.conversions++;
      totalConversions++;
      if (details.orderTotal) {
        stat.revenue += Number(details.orderTotal);
        totalSearchRevenue += Number(details.orderTotal);
      }
    }

    // Track failed (zero results) searches
    if (isZeroResults) {
      if (!failedQueries.has(q)) {
        failedQueries.set(q, {
          term: q,
          count: 0,
          lastSearched: log.createdAt || log.timestamp
        });
      }
      const failedStat = failedQueries.get(q);
      failedStat.count++;
      if (new Date(log.createdAt || log.timestamp) > new Date(failedStat.lastSearched)) {
        failedStat.lastSearched = log.createdAt || log.timestamp;
      }
    }
  });

  // Top 20 Searches
  const topSearches = Array.from(queryStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Failed Searches
  const topFailedSearches = Array.from(failedQueries.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const conversionRate = totalSearches > 0 ? ((totalConversions / totalSearches) * 100).toFixed(2) : 0;

  return res.json({
    success: true,
    timeframe,
    summary: {
      totalSearches,
      uniqueKeywords: queryStats.size,
      failedSearchesCount: failedQueries.size,
      totalConversions,
      conversionRate: Number(conversionRate),
      totalSearchRevenue: Math.round(totalSearchRevenue)
    },
    topSearches,
    failedSearches: topFailedSearches
  });
});

module.exports = {
  searchProducts,
  getSearchSuggestions,
  trackSearchEvent,
  getSearchAnalytics,
  clearSearchCache
};
