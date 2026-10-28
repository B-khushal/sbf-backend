// SBF Florist Centralized SEO Service
// Handles Dynamic XML Sitemap, Robots.txt, and Server-Rendered HTML for Crawlers

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const SITE_URL = 'https://sbflorist.in';
const BRAND_NAME = 'Spring Blossoms Florist';
const PHONE_NUMBER = '+919949683222';
const STUDIO_ADDRESS = {
  streetAddress: 'Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Road, Mehdipatnam',
  addressLocality: 'Hyderabad',
  addressRegion: 'Telangana',
  postalCode: '500006',
  addressCountry: 'IN'
};

// Escape XML special characters
const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Escape HTML special characters
const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper: load the index.html template from frontend dist or source
const getHtmlTemplate = () => {
  const pathsToTry = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, '..', '..', 'sbf-main', 'dist', 'index.html'),
    path.join(__dirname, '..', '..', 'sbf-main', 'index.html'),
  ];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch (err) {
        console.error(`Error reading index.html at ${p}:`, err.message);
      }
    }
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${BRAND_NAME}</title></head><body><div id="root"></div></body></html>`;
};

// In-memory cache for XML sitemaps (TTL: 1 hour)
const SITEMAP_CACHE_TTL = 3600 * 1000;
const sitemapCache = {
  index: { xml: null, expiresAt: 0, count: 0 },
  pages: { xml: null, expiresAt: 0, count: 0 },
  categories: { xml: null, expiresAt: 0, count: 0 },
  products: { xml: null, expiresAt: 0, count: 0 },
  occasions: { xml: null, expiresAt: 0, count: 0 },
  full: { xml: null, expiresAt: 0, count: 0 }
};

// Invalidate in-memory sitemap cache (e.g. after catalog update)
const invalidateSitemapCache = () => {
  for (const key of Object.keys(sitemapCache)) {
    sitemapCache[key] = { xml: null, expiresAt: 0, count: 0 };
  }
};

// Format date into standard W3C date (YYYY-MM-DD)
const formatW3cDate = (date) => {
  if (!date) return null;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
};

// Authoritative list of canonical public static & location pages
// Excludes auth-protected (/vendors-consent) and robots-disallowed (/vendor/register) routes
const STATIC_PAGE_DEFS = [
  { path: '/', lastmod: '2026-10-28' },
  { path: '/shop', lastmod: '2026-10-28' },
  { path: '/flower-delivery-hyderabad', lastmod: '2026-10-28' },
  { path: '/flower-delivery-secunderabad', lastmod: '2026-10-28' },
  { path: '/valentine-special', lastmod: '2026-10-27' },
  { path: '/valentine-shop', lastmod: '2026-10-27' },
  { path: '/about', lastmod: '2026-10-28' },
  { path: '/contact', lastmod: '2026-10-28' },
  { path: '/shipping', lastmod: '2026-10-28' },
  { path: '/privacy', lastmod: '2026-10-14' },
  { path: '/terms', lastmod: '2026-10-14' },
  { path: '/refund-policy', lastmod: '2026-10-28' },
  { path: '/cancellation-policy', lastmod: '2026-10-28' },
  { path: '/faq', lastmod: '2026-10-27' }
];

// Reserved static paths to prevent duplicate category inclusion
const RESERVED_STATIC_PATHS = new Set([...STATIC_PAGE_DEFS.map(p => p.path), '/occasions']);

// Normalize category path to its canonical non-redirecting route
const normalizeCanonicalCategoryPath = (cat) => {
  if (!cat) return null;
  if (!cat.slug && !cat.categoryUrl) return null;

  // Budget Friendly redirects from /budget-friendly to /shop/budget-friendly in App.tsx
  if (cat.slug === 'budget-friendly' || cat.categoryUrl === '/budget-friendly') {
    return '/shop/budget-friendly';
  }

  let cleanPath = cat.categoryUrl;
  if (!cleanPath || cleanPath === '/') {
    cleanPath = `/${cat.slug}`;
  }
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  cleanPath = cleanPath.replace(/\/+$/, '') || '/';

  // Multi-segment category paths like /cakes/birthday-cakes redirect to /:slug in CategoryResolver.tsx
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] !== 'shop' && segments[0] !== 'occasions' && cat.slug) {
    cleanPath = `/${cat.slug}`;
  }

  return cleanPath;
};

// Build deduplicated canonical category list from database records
const buildCanonicalCategoryItems = async () => {
  const prisma = require('../config/prisma');
  let categories = [];
  try {
    categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryUrl: true,
        updatedAt: true
      },
      orderBy: { displayOrder: 'asc' }
    });
  } catch (err) {
    console.error('Error fetching categories for sitemap:', err.message);
  }

  const seenUrls = new Set();
  const items = [];

  for (const cat of categories) {
    const cleanPath = normalizeCanonicalCategoryPath(cat);
    if (!cleanPath || RESERVED_STATIC_PATHS.has(cleanPath)) continue;

    const fullUrl = `${SITE_URL}${cleanPath}`;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    items.push({
      id: cat.id,
      name: cat.name || cat.slug,
      slug: cat.slug,
      cleanPath,
      url: fullUrl,
      lastmod: formatW3cDate(cat.updatedAt) || '2026-10-27'
    });
  }

  return items;
};

// Build deduplicated canonical occasion list from database records
const buildCanonicalOccasionItems = async () => {
  const prisma = require('../config/prisma');
  let occasions = [];
  try {
    occasions = await prisma.occasion.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true
      },
      orderBy: { displayOrder: 'asc' }
    });
  } catch (err) {
    console.error('Error fetching occasions for sitemap:', err.message);
  }

  const seenUrls = new Set();
  const items = [];

  // Primary Occasions Hub
  const baseOccUrl = `${SITE_URL}/occasions`;
  seenUrls.add(baseOccUrl);
  items.push({
    id: 'hub',
    name: 'All Occasions Directory Hub',
    slug: 'occasions',
    url: baseOccUrl,
    lastmod: '2026-10-28',
    isHub: true
  });

  for (const occ of occasions) {
    if (!occ.slug) continue;
    const occUrl = `${SITE_URL}/occasions/${occ.slug}`;
    if (seenUrls.has(occUrl)) continue;
    seenUrls.add(occUrl);

    items.push({
      id: occ.id,
      name: `${occ.name} Gifts & Flowers`,
      rawName: occ.name,
      slug: occ.slug,
      url: occUrl,
      lastmod: formatW3cDate(occ.updatedAt) || '2026-07-31',
      isHub: false
    });
  }

  return items;
};

// 1. Generate Static & Location Pages Sitemap
const generatePagesSitemapXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.pages.xml && sitemapCache.pages.expiresAt > now) {
    return sitemapCache.pages.xml;
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of STATIC_PAGE_DEFS) {
    const loc = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(loc)}</loc>\n`;
    if (page.lastmod) {
      xml += `    <lastmod>${escapeXml(page.lastmod)}</lastmod>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  sitemapCache.pages = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count: STATIC_PAGE_DEFS.length
  };

  return xml;
};

// 2. Generate Product Categories Sitemap
const generateCategoriesSitemapXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.categories.xml && sitemapCache.categories.expiresAt > now) {
    return sitemapCache.categories.xml;
  }

  const categoryItems = await buildCanonicalCategoryItems();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const item of categoryItems) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(item.url)}</loc>\n`;
    if (item.lastmod) {
      xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  sitemapCache.categories = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count: categoryItems.length
  };

  return xml;
};

// 3. Generate Individual Products Sitemap (with Google Image XML support)
const generateProductsSitemapXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.products.xml && sitemapCache.products.expiresAt > now) {
    return sitemapCache.products.xml;
  }

  const prisma = require('../config/prisma');
  let products = [];
  try {
    products = await prisma.product.findMany({
      where: {
        isVisible: true,
        approvalStatus: 'approved'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
        createdAt: true,
        images: {
          select: { url: true, alt: true, isPrimary: true },
          orderBy: { isPrimary: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  } catch (err) {
    console.error('Error fetching products for sitemap:', err.message);
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  const seenUrls = new Set();
  let count = 0;

  for (const prod of products) {
    if (!prod.id) continue;

    const prodUrl = `${SITE_URL}/product/${prod.id}`;
    if (seenUrls.has(prodUrl)) continue;
    seenUrls.add(prodUrl);

    const lastmod = formatW3cDate(prod.updatedAt || prod.createdAt);

    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(prodUrl)}</loc>\n`;
    if (lastmod) {
      xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    }

    // Google Image Sitemap XML Extension
    if (prod.images && prod.images.length > 0 && prod.images[0] && prod.images[0].url) {
      let imgUrl = prod.images[0].url.trim();
      if (imgUrl.startsWith('//')) {
        imgUrl = `https:${imgUrl}`;
      } else if (imgUrl.startsWith('/')) {
        imgUrl = `${SITE_URL}${imgUrl}`;
      }

      if (imgUrl.startsWith('https://') || imgUrl.startsWith('http://')) {
        const imgTitle = prod.images[0].alt || prod.name || 'Spring Blossoms Florist';
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(imgTitle)}</image:title>\n`;
        xml += '    </image:image>\n';
      }
    }

    xml += '  </url>\n';
    count++;
  }

  xml += '</urlset>\n';

  sitemapCache.products = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count
  };

  return xml;
};

// 4. Generate Occasions Sitemap
const generateOccasionsSitemapXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.occasions.xml && sitemapCache.occasions.expiresAt > now) {
    return sitemapCache.occasions.xml;
  }

  const occasionItems = await buildCanonicalOccasionItems();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const item of occasionItems) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(item.url)}</loc>\n`;
    if (item.lastmod) {
      xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  sitemapCache.occasions = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count: occasionItems.length
  };

  return xml;
};

// 5. Generate Primary Sitemap Index (/sitemap.xml)
const generateSitemapIndexXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.index.xml && sitemapCache.index.expiresAt > now) {
    return sitemapCache.index.xml;
  }

  const prisma = require('../config/prisma');

  // Discover latest modification dates for each child sitemap
  let latestPagesDate = '2026-10-28';
  let latestCatDate = '2026-10-27';
  let latestProdDate = '2026-10-27';
  let latestOccDate = '2026-10-28';

  try {
    const latestProd = await prisma.product.findFirst({
      where: { isVisible: true, approvalStatus: 'approved' },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    if (latestProd && latestProd.updatedAt) {
      latestProdDate = formatW3cDate(latestProd.updatedAt) || latestProdDate;
    }

    const latestCat = await prisma.category.findFirst({
      where: { isActive: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    if (latestCat && latestCat.updatedAt) {
      latestCatDate = formatW3cDate(latestCat.updatedAt) || latestCatDate;
    }

    const latestOcc = await prisma.occasion.findFirst({
      where: { isActive: true },
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    });
    if (latestOcc && latestOcc.updatedAt) {
      const occMod = formatW3cDate(latestOcc.updatedAt);
      if (occMod && occMod > latestOccDate) {
        latestOccDate = occMod;
      }
    }
  } catch (err) {
    console.error('Error fetching latest timestamps for sitemap index:', err.message);
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Child Sitemaps
  const childSitemaps = [
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastmod: latestPagesDate },
    { loc: `${SITE_URL}/sitemap-categories.xml`, lastmod: latestCatDate },
    { loc: `${SITE_URL}/sitemap-products.xml`, lastmod: latestProdDate },
    { loc: `${SITE_URL}/sitemap-occasions.xml`, lastmod: latestOccDate }
  ];

  for (const sitemap of childSitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
    if (sitemap.lastmod) {
      xml += `    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>\n`;
    }
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>\n';

  sitemapCache.index = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count: childSitemaps.length
  };

  return xml;
};

// 6. Generate Full Monolithic Sitemap (Single XML with all URLs)
const generateFullSitemapXml = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && sitemapCache.full.xml && sitemapCache.full.expiresAt > now) {
    return sitemapCache.full.xml;
  }

  // Pre-generate parts
  await Promise.all([
    generatePagesSitemapXml(forceRefresh),
    generateCategoriesSitemapXml(forceRefresh),
    generateProductsSitemapXml(forceRefresh),
    generateOccasionsSitemapXml(forceRefresh)
  ]);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  const extractUrls = (subXml) => {
    const matches = subXml.match(/<url>[\s\S]*?<\/url>/g);
    return matches ? matches.map(u => `  ${u.trim()}`).join('\n') : '';
  };

  const pagesBody = extractUrls(sitemapCache.pages.xml || '');
  const catBody = extractUrls(sitemapCache.categories.xml || '');
  const occBody = extractUrls(sitemapCache.occasions.xml || '');
  const prodBody = extractUrls(sitemapCache.products.xml || '');

  if (pagesBody) xml += `${pagesBody}\n`;
  if (catBody) xml += `${catBody}\n`;
  if (occBody) xml += `${occBody}\n`;
  if (prodBody) xml += `${prodBody}\n`;

  xml += '</urlset>\n';

  const totalCount = (sitemapCache.pages.count || 0) +
    (sitemapCache.categories.count || 0) +
    (sitemapCache.occasions.count || 0) +
    (sitemapCache.products.count || 0);

  sitemapCache.full = {
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL,
    count: totalCount
  };

  return xml;
};

// Master router function: defaults to Sitemap Index XML (or child by type)
const generateSitemapXml = async (type = 'index', forceRefresh = false) => {
  switch (type) {
    case 'pages':
    case 'static':
      return generatePagesSitemapXml(forceRefresh);
    case 'categories':
      return generateCategoriesSitemapXml(forceRefresh);
    case 'products':
      return generateProductsSitemapXml(forceRefresh);
    case 'occasions':
      return generateOccasionsSitemapXml(forceRefresh);
    case 'full':
    case 'single':
      return generateFullSitemapXml(forceRefresh);
    case 'index':
    default:
      return generateSitemapIndexXml(forceRefresh);
  }
};

// Structured data provider for interactive Sitemap UI & JSON API
const getSitemapData = async (type = 'index') => {
  const prisma = require('../config/prisma');

  const PAGE_LABELS = {
    '/': 'Home — Spring Blossoms Florist',
    '/shop': 'Shop All Flowers & Gifts',
    '/flower-delivery-hyderabad': 'Flower Delivery in Hyderabad (Local Hub)',
    '/flower-delivery-secunderabad': 'Flower Delivery in Secunderabad (Local Hub)',
    '/valentine-special': 'Valentine\'s Special Gifts Experience',
    '/valentine-shop': 'Valentine\'s Day Shop',
    '/about': 'About Spring Blossoms Florist',
    '/contact': 'Contact Us & Store Location',
    '/shipping': 'Shipping & Delivery Policy',
    '/privacy': 'Privacy Policy',
    '/terms': 'Terms of Service',
    '/refund-policy': 'Refund & Return Policy',
    '/cancellation-policy': 'Order Cancellation Policy',
    '/faq': 'Frequently Asked Questions (FAQ) — Spring Blossoms Florist'
  };

  const [categoryItems, occasionItems, pCount] = await Promise.all([
    buildCanonicalCategoryItems(),
    buildCanonicalOccasionItems(),
    prisma.product.count({ where: { isVisible: true, approvalStatus: 'approved' } }).catch(() => 180)
  ]);

  const pagesCount = STATIC_PAGE_DEFS.length;
  const catCount = categoryItems.length;
  const prodCount = pCount || 180;
  const occCount = occasionItems.length;

  const sitemapsMeta = [
    { id: 'index', name: 'sitemap.xml', url: `${SITE_URL}/sitemap.xml`, uiPath: '/sitemap', label: 'All Sitemaps (Index)', count: 4 },
    { id: 'pages', name: 'sitemap-pages.xml', url: `${SITE_URL}/sitemap-pages.xml`, uiPath: '/sitemap/pages', label: 'Pages', count: pagesCount },
    { id: 'categories', name: 'sitemap-categories.xml', url: `${SITE_URL}/sitemap-categories.xml`, uiPath: '/sitemap/categories', label: 'Categories', count: catCount },
    { id: 'products', name: 'sitemap-products.xml', url: `${SITE_URL}/sitemap-products.xml`, uiPath: '/sitemap/products', label: 'Products', count: prodCount },
    { id: 'occasions', name: 'sitemap-occasions.xml', url: `${SITE_URL}/sitemap-occasions.xml`, uiPath: '/sitemap/occasions', label: 'Occasions', count: occCount }
  ];

  let currentTitle = 'XML Sitemap Index';
  let currentSubtitle = `Master sitemap index containing 4 sub-sitemaps with ${pagesCount + catCount + prodCount + occCount} discoverable URLs for sbflorist.in`;
  let currentFile = 'sitemap.xml';
  let isIndex = false;
  let rows = [];

  if (type === 'index') {
    isIndex = true;
    currentTitle = 'XML Sitemap Index';
    currentFile = 'sitemap.xml';
  } else if (type === 'pages' || type === 'static') {
    currentTitle = 'Static & Location Pages Sitemap';
    currentSubtitle = 'Canonical public pages, local delivery hubs, policy pages, and customer FAQs.';
    currentFile = 'sitemap-pages.xml';

    rows = STATIC_PAGE_DEFS.map((p, idx) => {
      const fullUrl = p.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${p.path}`;
      const isHub = p.path.includes('delivery');
      const isPolicy = p.path.includes('policy') || p.path.includes('terms') || p.path.includes('privacy');
      return {
        idx: idx + 1,
        title: PAGE_LABELS[p.path] || p.path,
        url: fullUrl,
        lastmod: p.lastmod || '2026-10-28',
        badge: isHub ? 'Location Hub' : (isPolicy ? 'Legal / Policy' : 'Main Page'),
        badgeColor: isHub ? '#0284c7' : (isPolicy ? '#64748b' : '#be123c'),
        badgeBg: isHub ? '#e0f2fe' : (isPolicy ? '#f1f5f9' : '#ffe4e6')
      };
    });
  } else if (type === 'categories') {
    currentTitle = 'Product Categories Sitemap';
    currentSubtitle = 'Active category collections covering bouquets, roses, lilies, cakes, and gift combos.';
    currentFile = 'sitemap-categories.xml';

    rows = categoryItems.map((cat, index) => ({
      idx: index + 1,
      title: cat.name,
      url: cat.url,
      lastmod: cat.lastmod,
      badge: cat.cleanPath.includes('cake') ? 'Cakes' : (cat.cleanPath.includes('combo') ? 'Combos' : 'Flowers'),
      badgeColor: '#059669',
      badgeBg: '#ecfdf5'
    }));
  } else if (type === 'products') {
    currentTitle = 'Products Catalog Sitemap';
    currentSubtitle = 'Approved and visible handcrafted flower bouquets, cakes, and celebration gifts.';
    currentFile = 'sitemap-products.xml';

    let products = [];
    try {
      products = await prisma.product.findMany({
        where: { isVisible: true, approvalStatus: 'approved' },
        select: {
          id: true,
          name: true,
          slug: true,
          updatedAt: true,
          createdAt: true,
          images: { select: { url: true, alt: true }, orderBy: { isPrimary: 'desc' }, take: 1 }
        },
        orderBy: { updatedAt: 'desc' }
      });
    } catch (e) {
      console.error('Error fetching products for UI:', e.message);
    }

    const seenUrls = new Set();
    let idx = 1;
    for (const prod of products) {
      if (!prod.id) continue;
      const fullUrl = `${SITE_URL}/product/${prod.id}`;
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      rows.push({
        idx: idx++,
        title: prod.name,
        url: fullUrl,
        image: prod.images?.[0]?.url || '',
        lastmod: formatW3cDate(prod.updatedAt || prod.createdAt) || '2026-10-25',
        badge: 'In Stock',
        badgeColor: '#b45309',
        badgeBg: '#fef3c7'
      });
    }
  } else if (type === 'occasions') {
    currentTitle = 'Occasions & Celebrations Sitemap';
    currentSubtitle = 'Curated celebration gift collections for Birthday, Anniversary, Festivals, and Holidays.';
    currentFile = 'sitemap-occasions.xml';

    rows = occasionItems.map((occ, index) => ({
      idx: index + 1,
      title: occ.name,
      url: occ.url,
      lastmod: occ.lastmod,
      badge: occ.isHub ? 'Hub' : 'Celebration',
      badgeColor: occ.isHub ? '#7c3aed' : '#db2777',
      badgeBg: occ.isHub ? '#f5f3ff' : '#fdf2f8'
    }));
  }

  const childCards = [
    {
      id: 'pages',
      name: 'sitemap-pages.xml',
      url: `${SITE_URL}/sitemap-pages.xml`,
      uiPath: '/sitemap/pages',
      title: 'Static & Location Pages',
      desc: 'Core shop pages, Hyderabad & Secunderabad local delivery hubs, policy pages, and customer FAQs.',
      count: pagesCount,
      badge: `${pagesCount} Pages`,
      color: '#be123c',
      bg: '#fff1f2'
    },
    {
      id: 'categories',
      name: 'sitemap-categories.xml',
      url: `${SITE_URL}/sitemap-categories.xml`,
      uiPath: '/sitemap/categories',
      title: 'Product Categories',
      desc: 'All active catalog categories covering fresh bouquets, roses, lilies, celebration cakes, and hampers.',
      count: catCount,
      badge: `${catCount} Categories`,
      color: '#059669',
      bg: '#ecfdf5'
    },
    {
      id: 'products',
      name: 'sitemap-products.xml',
      url: `${SITE_URL}/sitemap-products.xml`,
      uiPath: '/sitemap/products',
      title: 'Products Catalog',
      desc: 'All active and approved handcrafted flower arrangements, cakes, and gifts with Google Images.',
      count: prodCount,
      badge: `${prodCount} Products`,
      color: '#b45309',
      bg: '#fef3c7'
    },
    {
      id: 'occasions',
      name: 'sitemap-occasions.xml',
      url: `${SITE_URL}/sitemap-occasions.xml`,
      uiPath: '/sitemap/occasions',
      title: 'Occasions & Celebrations',
      desc: 'Curated celebration hubs for Birthday, Anniversary, Romance, Congratulations, and festive holidays.',
      count: occCount,
      badge: `${occCount} Occasions`,
      color: '#7c3aed',
      bg: '#f5f3ff'
    }
  ];

  return {
    type,
    currentTitle,
    currentSubtitle,
    currentFile,
    isIndex,
    pagesCount,
    catCount,
    prodCount,
    occCount,
    sitemapsMeta,
    rows,
    childCards
  };
};

// Render Human-Friendly Interactive UI for Browser Visitors browsing .xml sitemaps
const renderSitemapUiHtml = async (type = 'index') => {
  const data = await getSitemapData(type);
  const {
    currentTitle,
    currentSubtitle,
    currentFile,
    isIndex,
    pagesCount,
    catCount,
    prodCount,
    occCount,
    sitemapsMeta,
    rows,
    childCards
  } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(currentTitle)} | ${BRAND_NAME}</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    :root {
      --primary: #be123c;
      --primary-hover: #9f1239;
      --primary-light: #fff1f2;
      --accent: #d97706;
      --bg: #fcfaf7;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px 16px 64px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .top-header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px 28px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }
    .brand-col h1 {
      font-size: 22px;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
    }
    .brand-col p {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-outline {
      background: #f8fafc;
      color: #334155;
      border: 1px solid var(--border);
    }
    .btn-outline:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-xml {
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 12px;
    }
    .btn-xml:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      border: 1px solid var(--primary);
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }
    .tabs-nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .tab-link {
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 6px;
      transition: all 0.15s;
    }
    .tab-link:hover {
      background: #f1f5f9;
      color: var(--text);
    }
    .tab-link.active {
      background: var(--primary-light);
      color: var(--primary);
    }
    .info-banner {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid var(--accent);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #92400e;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .filter-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 18px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .search-input {
      flex: 1;
      min-width: 220px;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid var(--border);
      border-radius: 6px;
      outline: none;
      background: #f8fafc;
    }
    .search-input:focus {
      border-color: var(--primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(190, 18, 60, 0.1);
    }
    .stats-badge {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .table-responsive {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
    }
    thead {
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
    }
    th {
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background-color: #fafbfd; }
    .link-title {
      font-weight: 600;
      color: var(--text);
      display: block;
      margin-bottom: 2px;
      font-size: 14px;
    }
    .link-url {
      color: var(--primary);
      text-decoration: none;
      word-break: break-all;
      font-size: 13px;
      transition: color 0.15s;
    }
    .link-url:hover {
      text-decoration: underline;
      color: var(--primary-hover);
    }
    .badge-chip {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .date-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    }
    .thumb-img {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      object-fit: cover;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--primary);
      background: var(--primary-light);
      border-radius: 6px;
      text-decoration: none;
      transition: all 0.15s;
    }
    .action-btn:hover {
      background: var(--primary);
      color: #ffffff;
    }
    .index-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      padding: 20px;
    }
    .sitemap-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      background: #ffffff;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sitemap-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.04);
      border-color: #cbd5e1;
    }
    .card-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .badge-count {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--primary-light);
      color: var(--primary);
    }
    .sitemap-card p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.45;
      margin-top: 6px;
      margin-bottom: 16px;
      flex-grow: 1;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .page-footer {
      margin-top: 32px;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
    .page-footer a {
      color: var(--primary);
      text-decoration: none;
    }
    @media (max-width: 640px) {
      body { padding: 16px 10px 48px; }
      .brand-row { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; justify-content: flex-start; }
      .tabs-nav { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 6px; }
      .tab-link { white-space: nowrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-header">
      <div class="brand-row">
        <div class="brand-col">
          <h1>${BRAND_NAME}</h1>
          <p>${escapeHtml(currentSubtitle)}</p>
        </div>
        <div class="header-actions">
          <a href="/${escapeHtml(currentFile)}" class="btn btn-xml" target="_blank" title="View underlying raw XML format">
            &lt;/&gt; Raw XML
          </a>
          <a href="/" class="btn btn-outline" target="_blank">
            Visit Store &nearr;
          </a>
        </div>
      </div>
      <div class="tabs-nav">
        ${sitemapsMeta.map(tab => {
          const isActive = (type === tab.id) || (type === 'static' && tab.id === 'pages');
          return `<a href="${tab.uiPath || `/sitemap/${tab.id}`}" class="tab-link ${isActive ? 'active' : ''}">${escapeHtml(tab.label)} (${tab.count})</a>`;
        }).join('')}
      </div>
    </div>

    <div class="info-banner">
      <span>
        <strong>Interactive Sitemap Directory:</strong> Click any section or URL below to explore. Search engines access valid XML directly at <code>/${escapeHtml(currentFile)}</code>.
      </span>
      <span style="font-size: 12px; color: #b45309;">
        Format: W3C Valid
      </span>
    </div>

    ${isIndex ? `
      <div class="table-card">
        <div class="index-grid">
          ${childCards.map(card => `
            <div class="sitemap-card">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span class="card-tag">${escapeHtml(card.title)}</span>
                  <span class="badge-count" style="color:${card.color}; background:${card.bg};">${escapeHtml(card.badge)}</span>
                </div>
                <h3 style="font-size:18px; margin-bottom:6px;">
                  <a href="${card.uiPath || `/sitemap/${card.id}`}" style="color:inherit; text-decoration:none;">${escapeHtml(card.name)}</a>
                </h3>
                <p>${escapeHtml(card.desc)}</p>
              </div>
              <div class="card-footer">
                <a href="${card.uiPath || `/sitemap/${card.id}`}" class="btn btn-primary" style="font-size:12px; padding:6px 14px;">Browse &rarr;</a>
                <a href="${card.url}" class="btn btn-xml" style="font-size:11px; padding:5px 10px;" target="_blank">&lt;/&gt; XML</a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div class="filter-card">
        <input 
          type="text" 
          id="sitemapSearch" 
          class="search-input" 
          placeholder="Filter ${rows.length} URLs in real-time (type name, route, or category)..." 
          autofocus
        />
        <span class="stats-badge" id="visibleCount">Showing ${rows.length} of ${rows.length} URLs</span>
      </div>

      <div class="table-card">
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                ${type === 'products' ? '<th style="width: 60px;">Image</th>' : ''}
                <th>Title &amp; Page</th>
                <th>Canonical URL</th>
                <th style="width: 120px;">Last Modified</th>
                <th style="width: 90px; text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr class="sitemap-row" data-search="${escapeHtml((r.title + ' ' + r.url).toLowerCase())}">
                  <td style="color: var(--text-muted); font-size: 12px; font-weight: 600;">${r.idx}</td>
                  ${type === 'products' ? `
                    <td>
                      ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.title)}" class="thumb-img" onerror="this.style.display='none'" />` : '<div class="thumb-img" style="display:flex;align-items:center;justify-content:center;font-size:18px;">🌸</div>'}
                    </td>
                  ` : ''}
                  <td>
                    <div class="link-title">${escapeHtml(r.title)}</div>
                    <span class="badge-chip" style="color: ${r.badgeColor || '#be123c'}; background: ${r.badgeBg || '#fff1f2'};">${escapeHtml(r.badge || 'Link')}</span>
                  </td>
                  <td>
                    <a href="${escapeHtml(r.url)}" target="_blank" class="link-url">${escapeHtml(r.url)}</a>
                  </td>
                  <td>
                    <span class="date-badge">${escapeHtml(r.lastmod)}</span>
                  </td>
                  <td style="text-align: center;">
                    <a href="${escapeHtml(r.url)}" target="_blank" class="action-btn" title="Open this page in a new tab">Open &nearr;</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}

    <div class="page-footer">
      <p>&copy; ${new Date().getFullYear()} ${BRAND_NAME}. Handcrafted in Hyderabad &amp; Secunderabad. <a href="/">sbflorist.in</a></p>
    </div>
  </div>

  <script>
    const searchInput = document.getElementById('sitemapSearch');
    const countDisplay = document.getElementById('visibleCount');
    const rows = document.querySelectorAll('.sitemap-row');
    
    if (searchInput && rows.length > 0) {
      searchInput.addEventListener('input', function() {
        const q = this.value.toLowerCase().trim();
        let matchCount = 0;
        
        rows.forEach(row => {
          const text = row.getAttribute('data-search') || row.innerText.toLowerCase();
          if (!q || text.includes(q)) {
            row.style.display = '';
            matchCount++;
          } else {
            row.style.display = 'none';
          }
        });
        
        if (countDisplay) {
          countDisplay.textContent = 'Showing ' + matchCount + ' of ' + rows.length + ' URLs';
        }
      });
    }
  </script>
</body>
</html>`;
};

// Generate standard robots.txt
const generateRobotsTxt = () => {
  return `# Robots.txt for Spring Blossoms Florist (https://sbflorist.in)
User-agent: *
Allow: /
Allow: /shop
Allow: /flower-delivery-hyderabad
Allow: /flower-delivery-secunderabad
Allow: /bouquets
Allow: /roses
Allow: /cakes
Allow: /combos
Allow: /sunflowers
Allow: /lilies
Allow: /flower-baskets
Allow: /hydrangea
Allow: /occasions/
Allow: /product/
Allow: /products/
Allow: /about
Allow: /contact
Allow: /terms
Allow: /privacy
Allow: /shipping
Allow: /refund-policy
Allow: /cancellation-policy

# Disallow private user states, checkout, and admin routes
Disallow: /admin/
Disallow: /vendor/
Disallow: /marketing/
Disallow: /checkout/
Disallow: /cart
Disallow: /profile
Disallow: /account
Disallow: /orders
Disallow: /login
Disallow: /signup
Disallow: /register
Disallow: /forgot-password
Disallow: /track/
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;
};

// Render full pre-rendered HTML for search engine crawlers and audit tools
const renderCrawlerHtml = async (reqPath) => {
  const Product = require('../models/Product');
  const Category = require('../models/Category');
  const Occasion = require('../models/Occasion');
  const template = getHtmlTemplate();

  const cleanPath = (reqPath || '/').split('?')[0].replace(/\/+$/, '') || '/';

  // Default Homepage Metadata
  let pageTitle = 'Flower Delivery in Hyderabad | Spring Blossoms Florist';
  let metaDescription = 'Send fresh flower bouquets, roses and thoughtful gifts with Spring Blossoms Florist in Hyderabad. Explore flowers for birthdays, anniversaries and special occasions.';
  let canonicalUrl = `${SITE_URL}${cleanPath === '/' ? '' : cleanPath}`;
  let ogImage = 'https://res.cloudinary.com/djtrhfqan/image/upload/v1791793252/logo_final_tp7ymk.png';
  let ogType = 'website';
  let structuredData = [];
  let bodyContent = '';

  // ── 1. PRODUCT PAGE ──────────────────────────────────────────────
  const productMatch = cleanPath.match(/^\/(product|products|valentine-product)\/([^/]+)$/);
  if (productMatch) {
    const idOrSlug = productMatch[2];
    let product = null;

    try {
      product = await Product.findById(idOrSlug);
    } catch (e) {
      // fallback
    }

    if (!product) {
      product = await Product.findOne({
        $or: [
          { _id: idOrSlug },
          { id: idOrSlug },
          { slug: idOrSlug },
          { valentineSlug: idOrSlug },
          { title: { $regex: new RegExp(`^${idOrSlug.replace(/-/g, ' ')}`, 'i') } }
        ]
      });
    }

    if (product) {
      const finalPrice = product.discount > 0
        ? Math.round(product.price * (1 - product.discount / 100))
        : product.price;

      const categoryName = typeof product.category === 'string'
        ? product.category
        : (product.category && product.category.name) || 'Flowers';

      const giftType = product.flowerType 
        ? `${product.flowerType} Flowers`
        : (categoryName === 'Cakes' ? 'Celebration Cakes' : categoryName === 'Combos' ? 'Flower & Cake Combos' : `${categoryName} Bouquets`);

      const productFeatures = product.shortDescription
        ? product.shortDescription.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : (product.flowerType || (product.tags && product.tags.length > 0 ? (Array.isArray(product.tags) ? product.tags.slice(0, 3).join(', ') : product.tags) : giftType.toLowerCase()));

      pageTitle = `${product.title} | ${giftType} in Hyderabad`;
      metaDescription = `Discover ${product.title}, featuring ${productFeatures}. Explore available variants, pricing from ₹${finalPrice}, and express same-day or midnight delivery in Hyderabad from Spring Blossoms Florist.`;
      canonicalUrl = `${SITE_URL}/product/${product._id}`;
      ogType = 'product';

      const primaryImg = (product.images && product.images[0]) || ogImage;
      ogImage = primaryImg.startsWith('/') ? `${SITE_URL}${primaryImg}` : primaryImg;

      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: metaDescription,
        image: product.images && product.images.length > 0
          ? product.images.map(img => img.startsWith('/') ? `${SITE_URL}${img}` : img)
          : [ogImage],
        sku: String(product._id),
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'INR',
          price: finalPrice,
          priceValidUntil: '2026-12-31',
          itemCondition: 'https://schema.org/NewCondition',
          availability: (product.stock !== undefined && product.stock <= 0)
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          seller: {
            '@type': 'Florist',
            name: BRAND_NAME,
            url: SITE_URL
          }
        }
      };

      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
          { '@type': 'ListItem', position: 3, name: product.title, item: canonicalUrl }
        ]
      };

      structuredData.push(productSchema, breadcrumbSchema);

      bodyContent = `
        <div class="sbf-crawler-shell p-6 max-w-5xl mx-auto">
          <nav aria-label="Breadcrumb" class="text-sm mb-4">
            <a href="/">Home</a> &gt; <a href="/shop">Shop</a> &gt; <span>${escapeHtml(product.title)}</span>
          </nav>
          <article class="product-summary grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="product-media">
              <img src="${escapeHtml(ogImage)}" alt="${escapeHtml(product.title)} - Fresh flower delivery Hyderabad" class="rounded-xl max-w-full h-auto" width="600" height="600" />
            </div>
            <div class="product-details">
              <h1 class="text-3xl font-extrabold text-slate-900 mb-2">${escapeHtml(product.title)}</h1>
              <p class="text-2xl font-bold text-rose-600 mb-4">₹${finalPrice} <span class="text-sm font-normal text-slate-500">Inclusive of all taxes</span></p>
              <div class="description text-slate-700 leading-relaxed mb-6">
                <p>${escapeHtml(metaDescription)}</p>
              </div>
              <div class="delivery-perks p-4 bg-rose-50 rounded-lg text-sm text-slate-800 mb-6">
                <p><strong>✓ Same-Day Flower Delivery Available:</strong> Order before 6:00 PM for doorstep delivery today across Hyderabad &amp; Secunderabad.</p>
                <p><strong>✓ Midnight Delivery Slot:</strong> Deliver between 11:00 PM - 11:59 PM to surprise your loved ones right on their special day.</p>
                <p><strong>✓ Free Delivery:</strong> Available on first order &amp; all orders ₹999+.</p>
              </div>
              <div class="store-contact text-sm text-slate-600">
                <p>Curated with love by <strong>Spring Blossoms Florist</strong>, Mehdipatnam Studio, Hyderabad.</p>
                <p>Need custom flowers? Call our florist studio directly: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a></p>
              </div>
            </div>
          </article>
        </div>
      `;
    }
  }

  // ── 2. HYDERABAD DELIVERY LANDING PAGE ────────────────────────────
  else if (cleanPath === '/flower-delivery-hyderabad') {
    pageTitle = 'Flower Delivery in Hyderabad | Send Flowers, Cakes & Gifts Online | Spring Blossoms Florist';
    metaDescription = 'Best flower delivery in Hyderabad by Spring Blossoms Florist. Send fresh roses, bouquets, birthday flowers, anniversary cakes & combos with same-day and midnight delivery.';
    canonicalUrl = `${SITE_URL}/flower-delivery-hyderabad`;

    const localBusinessSchema = {
      '@context': 'https://schema.org',
      '@type': 'Florist',
      name: BRAND_NAME,
      url: SITE_URL,
      telephone: PHONE_NUMBER,
      address: {
        '@type': 'PostalAddress',
        ...STUDIO_ADDRESS
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 17.3912,
        longitude: 78.4326
      },
      areaServed: {
        '@type': 'City',
        name: 'Hyderabad'
      },
      priceRange: '₹₹'
    };
    structuredData.push(localBusinessSchema);

    bodyContent = `
      <div class="sbf-crawler-shell p-6 max-w-5xl mx-auto">
        <nav aria-label="Breadcrumb" class="text-sm mb-4">
          <a href="/">Home</a> &gt; <span>Flower Delivery in Hyderabad</span>
        </nav>
        <header class="mb-8">
          <h1 class="text-3xl font-extrabold text-slate-900 mb-4">Online Flower Delivery in Hyderabad</h1>
          <p class="text-lg text-slate-700 leading-relaxed">
            Welcome to Spring Blossoms Florist, Hyderabad’s premier local floral studio offering same-day and midnight flower delivery across Banjara Hills, Jubilee Hills, Gachibowli, Madhapur, Hitec City, Kondapur, Mehdipatnam, Kukatpally, Begumpet, and 50+ localities.
          </p>
        </header>
        <section class="mb-8">
          <h2 class="text-2xl font-bold text-slate-800 mb-3">Fresh Flowers for Every Occasion in Hyderabad</h2>
          <p class="text-slate-600 leading-relaxed mb-4">
            Our expert florists assemble handcrafted bouquets daily using Dutch roses, oriental lilies, carnations, orchids, and sunflowers. Pair your floral bouquets with fresh bakery cakes (Dutch Truffle, Red Velvet, Black Forest) and imported chocolates for birthdays, anniversaries, weddings, and congratulations.
          </p>
          <ul class="list-disc pl-5 space-y-2 text-slate-700">
            <li><strong>Free Delivery:</strong> First order free for new customers, plus free delivery on all orders ₹999+.</li>
            <li><strong>Midnight Surprise Delivery:</strong> Guaranteed delivery between 11:00 PM and 11:59 PM.</li>
            <li><strong>Same-Day Dispatch:</strong> Order by daytime for fresh delivery in 2-4 hours.</li>
          </ul>
        </section>
        <section class="store-details p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <h3 class="text-xl font-bold text-slate-900 mb-2">Visit Our Hyderabad Studio</h3>
          <p class="text-slate-700 mb-2">${STUDIO_ADDRESS.streetAddress}, ${STUDIO_ADDRESS.addressLocality}, ${STUDIO_ADDRESS.addressRegion} ${STUDIO_ADDRESS.postalCode}</p>
          <p class="text-slate-700">Phone: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a> | Open Mon–Sun 9:00 AM – 9:00 PM</p>
        </section>
      </div>
    `;
  }

  // ── 3. SECUNDERABAD DELIVERY LANDING PAGE ─────────────────────────
  else if (cleanPath === '/flower-delivery-secunderabad') {
    pageTitle = 'Flower Delivery in Secunderabad | Online Flowers & Cakes | Spring Blossoms Florist';
    metaDescription = 'Send fresh flowers, roses, celebration cakes & gift hampers to Secunderabad with Spring Blossoms Florist. Same-day & midnight delivery across all Secunderabad areas.';
    canonicalUrl = `${SITE_URL}/flower-delivery-secunderabad`;

    bodyContent = `
      <div class="sbf-crawler-shell p-6 max-w-5xl mx-auto">
        <nav aria-label="Breadcrumb" class="text-sm mb-4">
          <a href="/">Home</a> &gt; <span>Flower Delivery in Secunderabad</span>
        </nav>
        <header class="mb-8">
          <h1 class="text-3xl font-extrabold text-slate-900 mb-4">Send Fresh Flowers to Secunderabad</h1>
          <p class="text-lg text-slate-700 leading-relaxed">
            Delivering farm-fresh bouquets, birthday cakes, and luxury gift hampers across Begumpet, Secunderabad Station, Bowenpally, Sainikpuri, Marredpally, ECIL, AS Rao Nagar, Neredmet, and surrounding pin codes.
          </p>
        </header>
        <section class="mb-8">
          <h2 class="text-2xl font-bold text-slate-800 mb-3">Guaranteed Fresh Floral Bouquets &amp; Cakes</h2>
          <p class="text-slate-600 leading-relaxed">
            Every arrangement is prepared by our master florists and transported with temperature-conscious handling to preserve peak freshness and vibrant colors.
          </p>
        </section>
      </div>
    `;
  }

  // ── 3.5. DEDICATED FAQ PAGE ────────────────────────────────────────
  else if (cleanPath === '/faq') {
    pageTitle = 'FAQs | Flower, Cake & Gift Delivery in Hyderabad | SB Florist';
    metaDescription = 'Find answers about flower delivery in Hyderabad and Secunderabad, bouquets, cakes, gift combos, order tracking, payments, cancellations and refunds at Spring Blossoms Florist.';
    canonicalUrl = `${SITE_URL}/faq`;

    const prisma = require('../config/prisma');
    let faqsList = [];
    try {
      faqsList = await prisma.faq.findMany({
        where: { isPublished: true },
        include: { category: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        take: 50
      });
    } catch (e) {
      console.warn('FAQ crawler fetch fallback:', e.message);
    }

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqsList.slice(0, 30).map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer.replace(/<[^>]+>/g, ' ')
        }
      }))
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Frequently Asked Questions', item: canonicalUrl }
      ]
    };

    structuredData.push(faqSchema, breadcrumbSchema);

    bodyContent = `
      <div class="sbf-crawler-shell p-6 max-w-5xl mx-auto">
        <nav aria-label="Breadcrumb" class="text-sm mb-4">
          <a href="/">Home</a> &gt; <span>Frequently Asked Questions</span>
        </nav>
        <header class="mb-8">
          <h1 class="text-3xl font-extrabold text-slate-900 mb-3">Frequently Asked Questions — Spring Blossoms Florist</h1>
          <p class="text-lg text-slate-700 leading-relaxed">
            Everything you need to know about ordering flowers, cakes, and gifts with Spring Blossoms Florist in Hyderabad &amp; Secunderabad.
          </p>
        </header>
        <section class="faqs-list space-y-6">
          ${faqsList.map(f => `
            <article class="faq-item border-b border-slate-200 pb-4">
              <h2 class="text-xl font-bold text-slate-900 mb-2">${escapeHtml(f.question)}</h2>
              <div class="text-slate-700 leading-relaxed">${f.answer}</div>
            </article>
          `).join('')}
        </section>
        <section class="support-contact mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <h2 class="text-xl font-bold text-slate-900 mb-2">Need Immediate Support?</h2>
          <p class="text-slate-700 mb-1">WhatsApp &amp; Phone: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a></p>
          <p class="text-slate-700 mb-1">Email: <a href="mailto:contact@sbflorist.in">contact@sbflorist.in</a></p>
          <p class="text-slate-700">Studio: ${STUDIO_ADDRESS.streetAddress}, ${STUDIO_ADDRESS.addressLocality}, ${STUDIO_ADDRESS.addressRegion} 500028</p>
        </section>
      </div>
    `;
  }

  // ── 4. CATEGORY / COLLECTION PAGE ────────────────────────────────
  else if (cleanPath.startsWith('/shop') || cleanPath.startsWith('/occasions') || cleanPath === '/cakes' || cleanPath === '/combos' || cleanPath.length > 1) {
    const segments = cleanPath.split('/').filter(Boolean);
    const candidateSlug = segments[segments.length - 1];

    let category = await Category.findOne({
      $or: [
        { slug: candidateSlug },
        { categoryUrl: cleanPath },
        { categoryUrl: `/${candidateSlug}` }
      ]
    });
    let occasion = null;

    if (!category) {
      occasion = await Occasion.findOne({ slug: candidateSlug });
    }

    if (category || occasion) {
      const entityName = category ? category.name : occasion.name;
      const entityDesc = (category ? (category.metaDescription || category.description) : occasion.description) ||
        `Explore handcrafted ${entityName} floral arrangements, bouquets, and gift sets from Spring Blossoms Florist in Hyderabad.`;

      const categoryH1Map = {
        'bouquets': 'Flower Bouquets in Hyderabad',
        'roses': 'Rose Bouquets in Hyderabad',
        'cakes': 'Cakes in Hyderabad for Every Celebration',
        'combos': 'Flower and Cake Combos in Hyderabad',
        'cake-flower-combos': 'Flower and Cake Combos in Hyderabad',
        'sunflowers': 'Sunflower Bouquets',
        'lilies': 'Lily Flowers and Bouquets',
        'flower-baskets': 'Flower Baskets for Special Occasions',
        'baskets': 'Flower Baskets for Special Occasions',
        'hydrangea': 'Hydrangea Flower Bouquets in Hyderabad'
      };
      const pageH1 = categoryH1Map[candidateSlug] || `${entityName} in Hyderabad`;

      pageTitle = (category && (category.metaTitle || category.seoTitle))
        ? (category.metaTitle || category.seoTitle)
        : `${entityName} Delivery in Hyderabad | Spring Blossoms Florist`;
      metaDescription = (category && (category.metaDescription || category.seoDescription))
        ? (category.metaDescription || category.seoDescription)
        : entityDesc;
      canonicalUrl = `${SITE_URL}${cleanPath}`;

      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Collections', item: `${SITE_URL}/shop` },
          { '@type': 'ListItem', position: 3, name: entityName, item: canonicalUrl }
        ]
      };
      structuredData.push(breadcrumbSchema);

      // Fetch sample products for this category to render crawlable links
      let products = [];
      try {
        products = await Product.find({
          hidden: { $ne: true },
          $or: [
            { category: entityName },
            { category: category ? category._id : null },
            { tags: entityName }
          ]
        }).limit(12);
      } catch (e) {}

      bodyContent = `
        <div class="sbf-crawler-shell p-6 max-w-5xl mx-auto">
          <nav aria-label="Breadcrumb" class="text-sm mb-4">
            <a href="/">Home</a> &gt; <a href="/shop">Shop</a> &gt; <span>${escapeHtml(entityName)}</span>
          </nav>
          <header class="mb-8">
            <h1 class="text-3xl font-extrabold text-slate-900 mb-3">${escapeHtml(pageH1)}</h1>
            <p class="text-slate-700 leading-relaxed">${escapeHtml(metaDescription)}</p>
          </header>
          <section class="products-grid">
            <h2 class="text-2xl font-bold text-slate-800 mb-4">Available ${escapeHtml(entityName)} Arrangements</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              ${products.map(p => `
                <article class="product-card border border-slate-200 rounded-xl p-4">
                  <a href="/product/${p._id}" class="block">
                    <img src="${p.images && p.images[0] ? escapeHtml(p.images[0]) : ogImage}" alt="${escapeHtml(p.title)}" class="w-full h-48 object-cover rounded-lg mb-3" loading="lazy" />
                    <h3 class="font-bold text-slate-900 text-base hover:text-rose-600">${escapeHtml(p.title)}</h3>
                    <p class="text-rose-600 font-bold mt-1">₹${p.price}</p>
                  </a>
                </article>
              `).join('')}
            </div>
          </section>
        </div>
      `;
    }
  }

  // ── 5. DEFAULT HOMEPAGE ──────────────────────────────────────────
  if (!bodyContent) {
    pageTitle = 'Flower Delivery in Hyderabad | Spring Blossoms Florist';
    metaDescription = 'Shop fresh bouquets, roses and flower gifts in Hyderabad with Spring Blossoms Florist. Explore flowers for special occasions, cakes and gift combos.';
    canonicalUrl = `${SITE_URL}/`;

    // Fetch sample featured products for crawlable homepage links
    let featuredList = [];
    try {
      featuredList = await Product.find({ hidden: { $ne: true }, isFeatured: true }).limit(8);
      if (featuredList.length === 0) {
        featuredList = await Product.find({ hidden: { $ne: true } }).limit(8);
      }
    } catch (e) {}

    const floristSchema = {
      '@context': 'https://schema.org',
      '@type': 'Florist',
      '@id': `${SITE_URL}/#business`,
      name: BRAND_NAME,
      url: `${SITE_URL}/`,
      telephone: PHONE_NUMBER,
      email: '2006sbf@gmail.com',
      logo: `${SITE_URL}/images/logosbf.png`,
      image: [
        `${SITE_URL}/images/logosbf.png`,
        `${SITE_URL}/images/hero-flower-shop.jpg`
      ],
      description: 'Spring Blossoms Florist offers flower bouquets, floral arrangements and gifts for birthdays, anniversaries, celebrations and other special occasions.',
      priceRange: '₹₹',
      address: {
        '@type': 'PostalAddress',
        ...STUDIO_ADDRESS
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 17.395077,
        longitude: 78.433996
      },
      hasMap: 'https://www.google.com/maps?cid=8660521669298042697',
      sameAs: [
        'https://www.google.com/maps?cid=8660521669298042697',
        'https://www.instagram.com/sbf_india/'
      ],
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: [
            'https://schema.org/Monday',
            'https://schema.org/Tuesday',
            'https://schema.org/Wednesday',
            'https://schema.org/Thursday',
            'https://schema.org/Friday',
            'https://schema.org/Saturday',
            'https://schema.org/Sunday'
          ],
          opens: '08:00',
          closes: '23:00'
        }
      ],
      areaServed: [
        { '@type': 'City', name: 'Hyderabad' },
        { '@type': 'City', name: 'Secunderabad' }
      ]
    };
    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: BRAND_NAME,
      publisher: { '@id': `${SITE_URL}/#business` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/shop?search={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };
    structuredData.push(floristSchema, websiteSchema);

    bodyContent = `
      <div class="sbf-crawler-shell max-w-7xl mx-auto px-4 py-8">
        <!-- Site Navigation -->
        <nav aria-label="Main Navigation" class="mb-8 pb-4 border-b border-slate-200">
          <ul class="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
            <li><a href="/shop" class="hover:text-rose-600">All Flowers</a></li>
            <li><a href="/bouquets" class="hover:text-rose-600">Bouquets in Hyderabad</a></li>
            <li><a href="/roses" class="hover:text-rose-600">Roses</a></li>
            <li><a href="/cakes" class="hover:text-rose-600">Cakes</a></li>
            <li><a href="/combos" class="hover:text-rose-600">Flower &amp; Cake Combos</a></li>
            <li><a href="/sunflowers" class="hover:text-rose-600">Sunflowers</a></li>
            <li><a href="/lilies" class="hover:text-rose-600">Lilies</a></li>
            <li><a href="/flower-baskets" class="hover:text-rose-600">Flower Baskets</a></li>
            <li><a href="/hydrangea" class="hover:text-rose-600">Hydrangeas</a></li>
            <li><a href="/flower-delivery-hyderabad" class="hover:text-rose-600">Hyderabad Delivery</a></li>
            <li><a href="/contact" class="hover:text-rose-600">Contact Us</a></li>
          </ul>
        </nav>

        <!-- Primary Hero Header -->
        <header class="hero-section mb-12 text-center max-w-4xl mx-auto">
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Flower Delivery in Hyderabad for Every Special Occasion
          </h1>
          <p class="text-lg text-slate-700 leading-relaxed mb-6">
            Send fresh bouquets, roses and flower gifts in Hyderabad with Spring Blossoms Florist. Explore flowers for special occasions, cakes and gift combos with guaranteed same-day delivery and signature midnight slots.
          </p>
          <div class="flex flex-wrap justify-center gap-4 text-sm font-semibold">
            <a href="/bouquets" class="px-6 py-3 bg-rose-600 text-white rounded-xl shadow-md hover:bg-rose-700">Shop Bouquets</a>
            <a href="/roses" class="px-6 py-3 bg-white text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50">Rose Bouquets</a>
            <a href="/cakes" class="px-6 py-3 bg-white text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50">Explore Cakes</a>
            <a href="/combos" class="px-6 py-3 bg-white text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50">Combos</a>
          </div>
        </header>

        <!-- Category Highlights Section with Semantic H2s -->
        <section class="category-highlights mb-16 space-y-10">
          <div class="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Shop Bouquets in Hyderabad</h2>
            <p class="text-slate-600 text-sm leading-relaxed mb-3">Discover handcrafted flower bouquets in Hyderabad designed for birthdays, anniversaries, and congratulations. From wrapped Dutch blooms to elegant floral hampers, order bouquets near me with same-day express doorstep delivery.</p>
            <a href="/bouquets" class="text-rose-600 font-semibold text-sm hover:underline">Explore All Bouquets &rarr;</a>
          </div>

          <div class="p-6 bg-rose-50/50 rounded-2xl border border-rose-100">
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Find Your Perfect Roses Bouquet</h2>
            <p class="text-slate-600 text-sm leading-relaxed mb-3">Fresh Dutch and Indian roses in classic red, blush pink, radiant yellow, and pristine white. Express romance, admiration, or gratitude with handcrafted rose bouquets in Hyderabad.</p>
            <div class="flex flex-wrap gap-3 text-xs font-semibold">
              <a href="/roses" class="px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-rose-700">All Roses Bouquet</a>
              <a href="/roses?color=red" class="px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-rose-700">Red Roses</a>
              <a href="/roses?color=pink" class="px-3 py-1.5 bg-white border border-pink-200 rounded-lg text-pink-700">Pink Roses</a>
              <a href="/roses?color=yellow" class="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-700">Yellow Roses</a>
              <a href="/roses?color=white" class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700">White Roses</a>
            </div>
          </div>

          <div class="p-6 bg-amber-50/40 rounded-2xl border border-amber-100">
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Sunflowers, Lilies and Fresh Seasonal Flowers</h2>
            <p class="text-slate-600 text-sm leading-relaxed mb-3">Brighten any room with golden sunflower bouquets, fragrant oriental lilies, and exotic hydrangea arrangements handpicked for longevity and vibrant aesthetics.</p>
            <div class="flex flex-wrap gap-3 text-xs font-semibold">
              <a href="/sunflowers" class="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-800">Sunflowers</a>
              <a href="/lilies" class="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-800">Lilies</a>
              <a href="/hydrangea" class="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-800">Hydrangeas</a>
            </div>
          </div>

          <div class="p-6 bg-purple-50/40 rounded-2xl border border-purple-100">
            <h2 class="text-2xl font-bold text-slate-900 mb-2">Cakes and Flower Gift Combos</h2>
            <p class="text-slate-600 text-sm leading-relaxed mb-3">Pair farm-fresh floral bouquets with delectable gourmet bakery cakes (Dutch Truffle, Red Velvet, Black Forest) and gift baskets for seamless birthday and anniversary gifting in Hyderabad.</p>
            <div class="flex flex-wrap gap-3 text-xs font-semibold">
              <a href="/cakes" class="px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-purple-700">Cakes Delivery</a>
              <a href="/combos" class="px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-purple-700">Flower &amp; Cake Combos</a>
              <a href="/flower-baskets" class="px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-purple-700">Flower Baskets</a>
            </div>
          </div>
        </section>

        <!-- Featured Products Collection -->
        <section class="featured-products mb-16">
          <h2 class="text-2xl font-bold text-slate-900 mb-6 text-center">Bestselling Bouquets &amp; Arrangements</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            ${featuredList.map(p => `
              <article class="product-item border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                <a href="/product/${p._id}" class="block">
                  <img src="${p.images && p.images[0] ? escapeHtml(p.images[0]) : ogImage}" alt="${escapeHtml(p.title)} - Handcrafted bouquet Hyderabad" class="w-full h-52 object-cover rounded-xl mb-3" loading="lazy" />
                  <h3 class="font-bold text-slate-900 text-base mb-1">${escapeHtml(p.title)}</h3>
                  <p class="text-rose-600 font-bold">₹${p.price}</p>
                </a>
              </article>
            `).join('')}
          </div>
        </section>

        <!-- Why Choose Spring Blossoms Florist -->
        <section class="why-choose-us mb-16 p-8 bg-gradient-to-br from-rose-50/50 to-pink-50/30 rounded-3xl border border-rose-100">
          <h2 class="text-2xl font-bold text-slate-900 mb-6 text-center">Why Order From Spring Blossoms Florist Hyderabad?</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="perk-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 class="text-lg font-bold text-slate-900 mb-2">🌸 Farm-Fresh Flowers Daily</h3>
              <p class="text-sm text-slate-600 leading-relaxed">Direct sourcing of Dutch roses, oriental lilies, orchids, and seasonal blossoms. Every stem is inspected for vibrancy and longevity before crafting your bouquet.</p>
            </div>
            <div class="perk-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 class="text-lg font-bold text-slate-900 mb-2">⚡ Punctual Same-Day &amp; Midnight Delivery</h3>
              <p class="text-sm text-slate-600 leading-relaxed">Order before 6:00 PM for same-day delivery. Book our popular midnight slot (11:00 PM – 11:59 PM) to ring in birthdays and anniversaries right on time.</p>
            </div>
            <div class="perk-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 class="text-lg font-bold text-slate-900 mb-2">📍 Authentic Local Florist Studio</h3>
              <p class="text-sm text-slate-600 leading-relaxed">Located at Mehdipatnam, Hyderabad. We personally prepare and hand-deliver your orders without passing them through impersonal courier networks.</p>
            </div>
          </div>
        </section>

        <!-- Coverage Localities -->
        <section class="delivery-coverage mb-16">
          <h2 class="text-2xl font-bold text-slate-900 mb-4 text-center">Flower &amp; Cake Delivery Across Hyderabad &amp; Secunderabad</h2>
          <p class="text-center text-slate-600 max-w-3xl mx-auto mb-6 text-sm">
            We deliver to over 100 pin codes across the Twin Cities. Popular delivery hubs include Banjara Hills, Jubilee Hills, Gachibowli, Madhapur, Hitec City, Kondapur, Mehdipatnam, Begumpet, Secunderabad, Sainikpuri, Marredpally, Kukatpally, Miyapur, Dilsukhnagar, and LB Nagar.
          </p>
        </section>

        <!-- FAQs Section -->
        <section class="faq-section mb-16 max-w-3xl mx-auto">
          <h2 class="text-2xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
          <div class="space-y-4">
            <div class="faq-item p-4 border border-slate-200 rounded-xl bg-white">
              <h3 class="font-bold text-slate-900 mb-1">Do you offer same-day flower delivery in Hyderabad?</h3>
              <p class="text-sm text-slate-600">Yes! Place your order during business hours and our local florists will handcraft and deliver your flowers within 2 to 4 hours anywhere in Hyderabad.</p>
            </div>
            <div class="faq-item p-4 border border-slate-200 rounded-xl bg-white">
              <h3 class="font-bold text-slate-900 mb-1">What are your delivery charges?</h3>
              <p class="text-sm text-slate-600">Free Delivery on your first order! Standard delivery is also FREE on all orders of ₹999 and above. Orders under ₹999 carry a nominal ₹150 delivery charge.</p>
            </div>
            <div class="faq-item p-4 border border-slate-200 rounded-xl bg-white">
              <h3 class="font-bold text-slate-900 mb-1">Can I send flowers and a cake together as a combo?</h3>
              <p class="text-sm text-slate-600">Absolutely! Choose from our curated combinations of fresh roses or lilies paired with Dutch Truffle, Red Velvet, or Black Forest cakes and personalized cards.</p>
            </div>
          </div>
        </section>

        <!-- Physical Studio Footer Details -->
        <footer class="studio-info pt-8 border-t border-slate-200 text-center text-xs text-slate-500">
          <p class="font-bold text-slate-700 text-sm mb-1">${BRAND_NAME} Studio</p>
          <p>${STUDIO_ADDRESS.streetAddress}, ${STUDIO_ADDRESS.addressLocality}, ${STUDIO_ADDRESS.addressRegion} ${STUDIO_ADDRESS.postalCode}</p>
          <p class="mt-1">Telephone: <a href="tel:${PHONE_NUMBER}">${PHONE_NUMBER}</a> | Email: contact@sbflorist.in</p>
        </footer>
      </div>
    `;
  }

  // Assemble full HTML document
  let finalHtml = template;

  // Replace Title & Canonical
  finalHtml = finalHtml.replace(/<title>[^]*?<\/title>/gi, '');
  finalHtml = finalHtml.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  finalHtml = finalHtml.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  finalHtml = finalHtml.replace(/<meta\s+(property|name)=["']og:[^>]*>/gi, '');
  finalHtml = finalHtml.replace(/<meta\s+(property|name)=["']twitter:[^>]*>/gi, '');

  const newHeadTags = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(metaDescription)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(metaDescription)}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:site_name" content="${BRAND_NAME}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    ${structuredData.map(schema => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`).join('\n')}
  `;

  finalHtml = finalHtml.replace(/<head>/i, `<head>${newHeadTags}`);

  // Inject body content inside <div id="root"> (handling either empty or populated root element)
  if (/<div id=["']root["']>[\s\S]*?<\/div>(?=\s*<\/body>|\s*<script\b)/i.test(finalHtml)) {
    finalHtml = finalHtml.replace(
      /<div id=["']root["']>[\s\S]*?<\/div>(?=\s*<\/body>|\s*<script\b)/i,
      `<div id="root">${bodyContent}</div>`
    );
  } else {
    finalHtml = finalHtml.replace(
      /<div id=["']root["']><\/div>/i,
      `<div id="root">${bodyContent}</div>`
    );
  }

  return finalHtml;
};

module.exports = {
  generateSitemapXml,
  generateSitemapIndexXml,
  generatePagesSitemapXml,
  generateCategoriesSitemapXml,
  generateProductsSitemapXml,
  generateOccasionsSitemapXml,
  generateFullSitemapXml,
  invalidateSitemapCache,
  sitemapCache,
  generateRobotsTxt,
  renderCrawlerHtml,
  renderSitemapUiHtml,
  getSitemapData,
  BRAND_NAME,
  SITE_URL,
  PHONE_NUMBER,
  STUDIO_ADDRESS
};
