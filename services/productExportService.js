const prisma = require('../config/prisma');

/**
 * Product Catalog CSV Export Service
 * Generates production-ready Meta Ads & Marketing catalog CSVs
 * Strictly adheres to 8 required columns:
 * 1. Product Image
 * 2. Product ID
 * 3. Product Name
 * 4. Short Description
 * 5. Price
 * 6. Availability
 * 7. Delivery Information
 * 8. Product URL
 */

const CSV_HEADERS = [
  'Product Image',
  'Product ID',
  'Product Name',
  'Short Description',
  'Price',
  'Availability',
  'Delivery Information',
  'Product URL'
];

/**
 * Escapes a cell value according to RFC 4180 CSV specifications.
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Cleans descriptions: removes HTML tags, decodes common entities, and removes unnecessary line breaks.
 */
function cleanDescription(text) {
  if (!text) return '';
  let str = String(text);

  // Decode common HTML entities
  str = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Strip HTML tags
  str = str.replace(/<[^>]*>/g, ' ');

  // Remove control characters, collapse line breaks & excessive spaces
  str = str.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return str;
}

// Cache for backup original images (loaded once if needed)
let backupOriginalMap = null;
function getBackupOriginalMap() {
  if (backupOriginalMap) return backupOriginalMap;
  backupOriginalMap = new Map();
  try {
    const fs = require('fs');
    const path = require('path');
    const backupPath = path.join(__dirname, '../../mongodb_backup/test/products.json');
    if (fs.existsSync(backupPath)) {
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      for (const bp of backupData) {
        if (Array.isArray(bp.originalImages) && bp.originalImages.length > 0) {
          const firstOrig = bp.originalImages[0];
          if (firstOrig && typeof firstOrig === 'string' && firstOrig.startsWith('http')) {
            if (bp._id) backupOriginalMap.set(String(bp._id), firstOrig);
            if (bp.slug) backupOriginalMap.set(String(bp.slug), firstOrig);
            if (bp.title) backupOriginalMap.set(String(bp.title).toLowerCase().trim(), firstOrig);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading backup original images map:', err);
  }
  return backupOriginalMap;
}

/**
 * Resolves a valid, absolute, publicly accessible HTTPS image URL.
 * Strictly prioritizes unwatermarked original images for the CSV file.
 */
function resolveImageUrl(product, frontendBaseUrl) {
  let rawUrl = '';

  // 1. Priority: Check product.details.originalImages (unwatermarked original images in DB)
  if (product.details && typeof product.details === 'object') {
    if (Array.isArray(product.details.originalImages) && product.details.originalImages.length > 0) {
      const firstOrig = product.details.originalImages.find(img => img && typeof img === 'string' && img.startsWith('http'));
      if (firstOrig) {
        rawUrl = firstOrig;
      }
    } else if (typeof product.details.originalImage === 'string' && product.details.originalImage.startsWith('http')) {
      rawUrl = product.details.originalImage;
    }
  }

  // 2. Check direct product.originalImages if present on model
  if (!rawUrl && Array.isArray(product.originalImages) && product.originalImages.length > 0) {
    const firstOrig = product.originalImages.find(img => img && typeof img === 'string' && img.startsWith('http'));
    if (firstOrig) {
      rawUrl = firstOrig;
    }
  }

  // 3. Check ProductImage relations for explicit unwatermarked / original image
  if (!rawUrl && Array.isArray(product.images) && product.images.length > 0) {
    const unwatermarkedImg = product.images.find(img => {
      const u = typeof img === 'string' ? img : (img.url || '');
      const alt = (img && typeof img === 'object' && img.alt) ? String(img.alt).toLowerCase() : '';
      const lower = u.toLowerCase();
      return (
        lower.includes('_original') ||
        lower.includes('unwatermarked') ||
        lower.includes('no-watermark') ||
        lower.includes('clean') ||
        alt.includes('unwatermarked') ||
        alt.includes('no-watermark') ||
        alt.includes('original')
      );
    });

    if (unwatermarkedImg) {
      rawUrl = typeof unwatermarkedImg === 'string' ? unwatermarkedImg : (unwatermarkedImg.url || '');
    }
  }

  // 4. Check backup cache for migrated unwatermarked original image
  if (!rawUrl) {
    const origMap = getBackupOriginalMap();
    if (product.id && origMap.has(String(product.id))) {
      rawUrl = origMap.get(String(product.id));
    } else if (product.slug && origMap.has(String(product.slug))) {
      rawUrl = origMap.get(String(product.slug));
    } else if (product.name && origMap.has(String(product.name).toLowerCase().trim())) {
      rawUrl = origMap.get(String(product.name).toLowerCase().trim());
    }
  }

  // 5. Standard fallback: First/Primary ProductImage relation
  if (!rawUrl && Array.isArray(product.images) && product.images.length > 0) {
    const primary = product.images.find(img => img.isPrimary) || product.images[0];
    rawUrl = typeof primary === 'string' ? primary : (primary.url || '');
  }

  // 6. Fallback: details.images
  if (!rawUrl && product.details && typeof product.details === 'object') {
    if (Array.isArray(product.details.images) && product.details.images.length > 0) {
      const first = product.details.images[0];
      rawUrl = typeof first === 'string' ? first : (first?.url || '');
    } else if (typeof product.details.image === 'string') {
      rawUrl = product.details.image;
    }
  }

  // 7. Fallback: direct product.image field
  if (!rawUrl && typeof product.image === 'string') {
    rawUrl = product.image;
  }

  rawUrl = (rawUrl || '').trim();
  if (!rawUrl || rawUrl === 'undefined' || rawUrl === 'null') {
    return '';
  }

  // If already HTTPS Cloudinary or other HTTPS URL
  if (rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  // Upgrade HTTP to HTTPS (except if localhost)
  if (rawUrl.startsWith('http://')) {
    if (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
      return '';
    }
    return rawUrl.replace('http://', 'https://');
  }

  // Handle local upload paths like /uploads/...
  const cleanBase = frontendBaseUrl.replace(/\/+$/, '');
  if (rawUrl.startsWith('/')) {
    return `${cleanBase}${rawUrl}`;
  }

  return `${cleanBase}/uploads/${rawUrl}`;
}

/**
 * Resolves the clean, standardized delivery information string based on product configuration.
 * Supported values: Same-Day Delivery, Midnight Delivery, Standard Delivery
 */
function resolveDeliveryInfo(product) {
  const details = (product.details && typeof product.details === 'object') ? product.details : {};

  // If explicit array configured in details
  if (Array.isArray(details.deliveryOptions) && details.deliveryOptions.length > 0) {
    const mapped = details.deliveryOptions.map(opt => {
      const o = String(opt).toLowerCase().trim();
      if (o.includes('same')) return 'Same-Day Delivery';
      if (o.includes('midnight')) return 'Midnight Delivery';
      if (o.includes('standard')) return 'Standard Delivery';
      return null;
    }).filter(Boolean);
    if (mapped.length > 0) {
      return Array.from(new Set(mapped)).join(' / ');
    }
  }

  const isSameDay = product.sameDay !== false && details.sameDay !== false;
  const isMidnight = Boolean(
    isSameDay ||
    product.midnight ||
    details.midnight ||
    details.midnightDelivery ||
    product.midnightDelivery ||
    (product.dateWiseDeliveryCharges && typeof product.dateWiseDeliveryCharges === 'object' && Object.keys(product.dateWiseDeliveryCharges).some(k => k.toLowerCase().includes('midnight')))
  );
  const isStandard = product.standardDelivery !== false && details.standardDelivery !== false;


  const options = [];
  if (isSameDay) options.push('Same-Day Delivery');
  if (isMidnight) options.push('Midnight Delivery');
  if (isStandard) options.push('Standard Delivery');

  if (options.length === 0) {
    options.push('Standard Delivery');
  }

  return options.join(' / ');
}

/**
 * Checks if a product matches any of the given category tokens.
 */
function productMatchesCategories(product, categoryTokens) {
  if (!categoryTokens || categoryTokens.length === 0) return true;

  const normalizedTokens = categoryTokens.map(t => String(t).toLowerCase().trim());
  const tokenSet = new Set(normalizedTokens);

  // Collect all category identifiers for this product
  const productCatStrings = new Set();

  if (product.category) {
    productCatStrings.add(String(product.category).toLowerCase().trim());
    productCatStrings.add(String(product.category).toLowerCase().trim().replace(/\s+/g, '-'));
  }
  if (product.subcategory) {
    productCatStrings.add(String(product.subcategory).toLowerCase().trim());
    productCatStrings.add(String(product.subcategory).toLowerCase().trim().replace(/\s+/g, '-'));
  }

  if (Array.isArray(product.categories)) {
    product.categories.forEach(c => {
      if (typeof c === 'string') {
        productCatStrings.add(c.toLowerCase().trim());
        productCatStrings.add(c.toLowerCase().trim().replace(/\s+/g, '-'));
      } else if (c) {
        if (c.id) productCatStrings.add(String(c.id).toLowerCase().trim());
        if (c.slug) productCatStrings.add(String(c.slug).toLowerCase().trim());
        if (c.name) productCatStrings.add(String(c.name).toLowerCase().trim());
        if (c.category) {
          if (c.category.id) productCatStrings.add(String(c.category.id).toLowerCase().trim());
          if (c.category.slug) productCatStrings.add(String(c.category.slug).toLowerCase().trim());
          if (c.category.name) productCatStrings.add(String(c.category.name).toLowerCase().trim());
        }
      }
    });
  }

  if (product.details && typeof product.details === 'object') {
    if (Array.isArray(product.details.categories)) {
      product.details.categories.forEach(c => {
        if (typeof c === 'string') {
          productCatStrings.add(c.toLowerCase().trim());
          productCatStrings.add(c.toLowerCase().trim().replace(/\s+/g, '-'));
        }
      });
    }
    if (typeof product.details.category === 'string') {
      productCatStrings.add(product.details.category.toLowerCase().trim());
      productCatStrings.add(product.details.category.toLowerCase().trim().replace(/\s+/g, '-'));
    }
  }

  // Direct set match
  for (const token of normalizedTokens) {
    if (tokenSet.has('all')) return true;
    if (productCatStrings.has(token)) return true;

    // Substring / fuzzy category matches (e.g. "bouquets" matching "romantic-bouquets" or "birthday-bouquets")
    for (const pCat of productCatStrings) {
      if (pCat.includes(token) || token.includes(pCat)) {
        return true;
      }
    }

    // Special category alias checks
    if (token === 'bouquets' && Array.from(productCatStrings).some(s => s.includes('bouquet'))) return true;
    if (token === 'plants' && Array.from(productCatStrings).some(s => s.includes('plant'))) return true;
    if (token === 'arrangements' && Array.from(productCatStrings).some(s => s.includes('arrangement'))) return true;
    if (token === 'cakes' && Array.from(productCatStrings).some(s => s.includes('cake'))) return true;
    if (token === 'combos' && Array.from(productCatStrings).some(s => s.includes('combo'))) return true;
    if ((token === 'gifts' || token === 'gift-hampers') && Array.from(productCatStrings).some(s => s.includes('gift') || s.includes('hamper'))) return true;
    if ((token === 'add-ons' || token === 'addons') && Array.from(productCatStrings).some(s => s.includes('addon') || s.includes('add-on'))) return true;
  }

  return false;
}

/**
 * Main function to generate the Product Catalog CSV.
 * 
 * @param {Object} options
 * @param {string} [options.type='all'] - 'all' | 'categories' | 'products'
 * @param {string|string[]} [options.categoryIds] - Comma-separated string or array of category slugs/ids
 * @param {string|string[]} [options.productIds] - Comma-separated string or array of product ids
 * @param {Object} [options.user] - Authenticated user for vendor scoping
 * @returns {Promise<{ csv: string, filename: string, totalCount: number, completeCount: number, warningCount: number, warnings: Array }>}
 */
async function generateProductCatalogCsv(options = {}) {
  const {
    type = 'all',
    categoryIds,
    productIds,
    user
  } = options;

  const frontendBaseUrl = (process.env.FRONTEND_URL || 'https://sbflorist.in').replace(/\/+$/, '');

  // Parse category tokens
  let parsedCategoryTokens = [];
  if (categoryIds) {
    parsedCategoryTokens = (Array.isArray(categoryIds) ? categoryIds : String(categoryIds).split(','))
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
  }

  // Parse product IDs
  let parsedProductIds = [];
  if (productIds) {
    parsedProductIds = (Array.isArray(productIds) ? productIds : String(productIds).split(','))
      .map(id => id.trim())
      .filter(Boolean);
  }

  // Base Prisma WHERE clause
  const where = {};

  // Vendor restriction: vendors can only export their own products
  if (user && user.role === 'vendor') {
    where.vendorId = user._id || user.id;
  }

  const isSpecificProductsExport = (type === 'products' || (parsedProductIds.length > 0 && type !== 'all' && type !== 'categories'));

  if (isSpecificProductsExport) {
    where.OR = [
      { id: { in: parsedProductIds } },
      { sku: { in: parsedProductIds } }
    ];
  } else {
    // Respect customer-facing visibility rules: visible and approved only
    where.isVisible = true;
    where.approvalStatus = 'approved';
  }

  // Fetch products with relations from Prisma
  const rawProducts = await prisma.product.findMany({
    where,
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      priceVariants: { orderBy: { price: 'asc' } },
      categories: { include: { category: true } },
      occasions: { include: { occasion: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Filter products by category if type is 'categories' or categoryIds provided
  let filteredProducts = rawProducts;
  if (!isSpecificProductsExport && parsedCategoryTokens.length > 0 && !parsedCategoryTokens.includes('all')) {
    filteredProducts = rawProducts.filter(p => productMatchesCategories(p, parsedCategoryTokens));
  }

  // Check if Add-ons should be included from AddonProduct table
  const shouldIncludeAddonTable = (
    !isSpecificProductsExport &&
    (type === 'all' || parsedCategoryTokens.includes('all') || parsedCategoryTokens.includes('add-ons') || parsedCategoryTokens.includes('addons'))
  );

  let addonRecords = [];
  if (shouldIncludeAddonTable) {
    try {
      addonRecords = await prisma.addonProduct.findMany({
        where: { isActive: true }
      });
    } catch (addonErr) {
      console.error('Error fetching addonProduct records for export:', addonErr);
    }
  } else if (isSpecificProductsExport) {
    try {
      addonRecords = await prisma.addonProduct.findMany({
        where: { id: { in: parsedProductIds } }
      });
    } catch (addonErr) {
      console.error('Error fetching addon records for specific products export:', addonErr);
    }
  }

  const warnings = [];
  const rows = [];
  const seenProductIds = new Set();

  // Helper to record a warning
  const recordWarning = (productId, productName, issue) => {
    warnings.push({
      productId: productId || 'Unknown ID',
      productName: productName || 'Untitled Product',
      issue
    });
  };

  // Process standard products
  for (const product of filteredProducts) {
    const productId = product.sku || product.id;
    if (seenProductIds.has(productId)) {
      continue;
    }
    seenProductIds.add(productId);

    let hasIssue = false;

    // 1. Product Image
    const imageUrl = resolveImageUrl(product, frontendBaseUrl);
    if (!imageUrl) {
      recordWarning(productId, product.name, 'Missing primary image or non-HTTPS URL');
      hasIssue = true;
    }

    // 2. Product ID
    if (!productId) {
      recordWarning(product.id || 'N/A', product.name, 'Missing unique product ID');
      hasIssue = true;
    }

    // 3. Product Name
    const productName = (product.name || '').trim();
    if (!productName) {
      recordWarning(productId, 'N/A', 'Missing product name');
      hasIssue = true;
    }

    // 4. Short Description
    const shortDesc = cleanDescription(product.shortDescription || product.description || '');
    if (!shortDesc) {
      // Missing description is reported as warning per rule 11
      recordWarning(productId, productName, 'Missing product description');
      hasIssue = true;
    }

    // 5. Price
    const basePrice = parseFloat(product.price || 0);
    const discount = parseFloat(product.discount || (product.details && product.details.discount) || 0);
    let sellingPrice = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : Math.round(basePrice);
    if (sellingPrice <= 0 && basePrice > 0) {
      sellingPrice = Math.round(basePrice);
    }

    if (sellingPrice <= 0) {
      recordWarning(productId, productName, 'Selling price is zero or missing');
      hasIssue = true;
    }
    const priceStr = sellingPrice > 0 ? String(sellingPrice) : '';

    // 6. Availability
    const isAvailable = product.isAvailable !== false;
    const stock = (product.stock !== undefined && product.stock !== null)
      ? parseInt(product.stock)
      : ((product.countInStock !== undefined && product.countInStock !== null) ? parseInt(product.countInStock) : 0);
    const isInStock = isAvailable && stock > 0;
    const availability = isInStock ? 'In Stock' : 'Out of Stock';

    // 7. Delivery Information
    const deliveryInfo = resolveDeliveryInfo(product);

    // 8. Product URL
    const slug = product.slug || product.id;
    let productUrl = '';
    if (slug) {
      productUrl = `${frontendBaseUrl}/product/${encodeURIComponent(slug)}`;
    } else {
      recordWarning(productId, productName, 'Cannot generate public product URL');
      hasIssue = true;
    }

    // Ensure no null or "undefined" strings
    const rowValues = [
      imageUrl || '',
      productId || '',
      productName || '',
      shortDesc || '',
      priceStr || '',
      availability,
      deliveryInfo || 'Standard Delivery',
      productUrl || ''
    ];

    rows.push({
      values: rowValues,
      hasIssue
    });
  }

  // Process Add-on items if applicable
  for (const addon of addonRecords) {
    const addonId = addon.id;
    if (seenProductIds.has(addonId)) {
      continue;
    }
    seenProductIds.add(addonId);

    let hasIssue = false;
    let imageUrl = (addon.image || '').trim();
    if (imageUrl.startsWith('http://')) {
      imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl.startsWith('/')) {
      imageUrl = `${frontendBaseUrl}${imageUrl}`;
    }

    if (!imageUrl) {
      recordWarning(addonId, addon.name, 'Addon missing image URL');
      hasIssue = true;
    }

    const addonName = (addon.name || '').trim();
    const shortDesc = cleanDescription(addon.description || '');
    const priceNum = Math.round(parseFloat(addon.price || 0));
    if (priceNum <= 0) {
      recordWarning(addonId, addonName, 'Addon missing price');
      hasIssue = true;
    }

    const availability = addon.isActive ? 'In Stock' : 'Out of Stock';
    const deliveryInfo = 'Same-Day Delivery / Midnight Delivery / Standard Delivery';
    const productUrl = `${frontendBaseUrl}/product/${encodeURIComponent(addon.id)}`;


    rows.push({
      values: [
        imageUrl || '',
        addonId || '',
        addonName || '',
        shortDesc || '',
        priceNum > 0 ? String(priceNum) : '',
        availability,
        deliveryInfo,
        productUrl
      ],
      hasIssue
    });
  }

  // Construct CSV content with UTF-8 BOM
  const headerLine = CSV_HEADERS.map(escapeCsvCell).join(',');
  const rowLines = rows.map(r => r.values.map(escapeCsvCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  // Dynamic filename generation
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  let filename = `sbf-product-catalog-${dateStr}.csv`;

  if (isSpecificProductsExport) {
    filename = `sbf-selected-products-${dateStr}.csv`;
  } else if (parsedCategoryTokens.length === 1 && parsedCategoryTokens[0] !== 'all') {
    const safeCat = parsedCategoryTokens[0].replace(/[^a-z0-9_-]/g, '');
    filename = `sbf-${safeCat}-catalog-${dateStr}.csv`;
  } else if (parsedCategoryTokens.length > 1) {
    filename = `sbf-categories-catalog-${dateStr}.csv`;
  }

  const totalCount = rows.length;
  const warningCount = warnings.length;
  const completeCount = rows.filter(r => !r.hasIssue).length;

  return {
    csv: csvContent,
    filename,
    totalCount,
    completeCount,
    warningCount,
    warnings
  };
}

module.exports = {
  generateProductCatalogCsv,
  CSV_HEADERS
};
