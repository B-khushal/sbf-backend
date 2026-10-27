// SBF Florist Centralized SEO Service
// Handles Dynamic XML Sitemap, Robots.txt, and Server-Rendered HTML for Crawlers

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const SITE_URL = 'https://sbflorist.in';
const BRAND_NAME = 'Spring Blossoms Florist';
const PHONE_NUMBER = '+91 9949683222';
const STUDIO_ADDRESS = {
  streetAddress: 'Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam',
  addressLocality: 'Hyderabad',
  addressRegion: 'Telangana',
  postalCode: '500028',
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

// Generate Dynamic XML Sitemap using real database records
const generateSitemapXml = async () => {
  const Product = require('../models/Product');
  const Category = require('../models/Category');
  const Occasion = require('../models/Occasion');

  const now = new Date().toISOString().split('T')[0];

  // Core Static Routes
  const staticRoutes = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/flower-delivery-hyderabad`, priority: '0.95', changefreq: 'weekly' },
    { loc: `${SITE_URL}/flower-delivery-secunderabad`, priority: '0.95', changefreq: 'weekly' },
    { loc: `${SITE_URL}/shop`, priority: '0.90', changefreq: 'daily' },
    { loc: `${SITE_URL}/cakes`, priority: '0.85', changefreq: 'weekly' },
    { loc: `${SITE_URL}/combos`, priority: '0.85', changefreq: 'weekly' },
    { loc: `${SITE_URL}/about`, priority: '0.70', changefreq: 'monthly' },
    { loc: `${SITE_URL}/contact`, priority: '0.70', changefreq: 'monthly' },
    { loc: `${SITE_URL}/shipping`, priority: '0.60', changefreq: 'monthly' },
    { loc: `${SITE_URL}/terms`, priority: '0.50', changefreq: 'monthly' },
    { loc: `${SITE_URL}/privacy`, priority: '0.50', changefreq: 'monthly' },
    { loc: `${SITE_URL}/refund-policy`, priority: '0.50', changefreq: 'monthly' },
    { loc: `${SITE_URL}/cancellation-policy`, priority: '0.50', changefreq: 'monthly' }
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // 1. Add Static Routes
  for (const route of staticRoutes) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(route.loc)}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // 2. Add Dynamic Categories from Database
  try {
    const categories = await Category.find({
      $or: [{ status: 'active' }, { isActive: true }, { status: { $exists: false } }]
    });

    for (const cat of categories) {
      if (!cat.slug) continue;
      const catUrl = cat.categoryUrl ? `${SITE_URL}${cat.categoryUrl.startsWith('/') ? '' : '/'}${cat.categoryUrl}` : `${SITE_URL}/${cat.slug}`;
      const catDate = cat.updatedAt ? new Date(cat.updatedAt).toISOString().split('T')[0] : now;

      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(catUrl)}</loc>\n`;
      xml += `    <lastmod>${catDate}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.80</priority>\n';
      xml += '  </url>\n';
    }
  } catch (err) {
    console.error('Error fetching categories for sitemap:', err.message);
  }

  // 3. Add Dynamic Occasions from Database
  try {
    const occasions = await Occasion.find({
      $or: [{ isActive: true }, { status: 'active' }, { isActive: { $exists: false } }]
    });

    for (const occ of occasions) {
      if (!occ.slug) continue;
      const occUrl = `${SITE_URL}/occasions/${occ.slug}`;
      const occDate = occ.updatedAt ? new Date(occ.updatedAt).toISOString().split('T')[0] : now;

      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(occUrl)}</loc>\n`;
      xml += `    <lastmod>${occDate}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.75</priority>\n';
      xml += '  </url>\n';
    }
  } catch (err) {
    console.error('Error fetching occasions for sitemap:', err.message);
  }

  // 4. Add Real Active Products from Database
  try {
    const products = await Product.find({
      hidden: { $ne: true },
      $or: [
        { isVisible: true },
        { isVisible: { $exists: false } }
      ]
    });

    for (const prod of products) {
      const prodUrl = `${SITE_URL}/product/${prod._id}`;
      const prodDate = prod.updatedAt
        ? new Date(prod.updatedAt).toISOString().split('T')[0]
        : (prod.createdAt ? new Date(prod.createdAt).toISOString().split('T')[0] : now);

      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(prodUrl)}</loc>\n`;
      xml += `    <lastmod>${prodDate}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.70</priority>\n';

      // Include product primary image if available
      if (prod.images && prod.images.length > 0 && prod.images[0]) {
        let imgUrl = prod.images[0];
        if (imgUrl.startsWith('/')) {
          imgUrl = `${SITE_URL}${imgUrl}`;
        }
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(prod.title || '')}</image:title>\n`;
        xml += '    </image:image>\n';
      }

      xml += '  </url>\n';
    }
  } catch (err) {
    console.error('Error fetching products for sitemap:', err.message);
  }

  xml += '</urlset>\n';
  return xml;
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
      '@graph': [
        {
          '@type': 'Florist',
          '@id': `${SITE_URL}/#florist`,
          name: BRAND_NAME,
          alternateName: 'SB Florist',
          url: SITE_URL,
          logo: `${SITE_URL}/logo.png`,
          image: `${SITE_URL}/logo.png`,
          description: 'Premium local florist offering handcrafted floral bouquets, celebration cakes, and gift delivery across Hyderabad and Secunderabad.',
          telephone: PHONE_NUMBER,
          priceRange: '₹₹',
          address: {
            '@type': 'PostalAddress',
            ...STUDIO_ADDRESS
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 17.3912,
            longitude: 78.4326
          },
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              opens: '09:00',
              closes: '21:00'
            }
          ],
          areaServed: [
            { '@type': 'City', name: 'Hyderabad' },
            { '@type': 'City', name: 'Secunderabad' }
          ]
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          url: SITE_URL,
          name: BRAND_NAME,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/shop?q={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        }
      ]
    };
    structuredData.push(floristSchema);

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
  generateRobotsTxt,
  renderCrawlerHtml,
  BRAND_NAME,
  SITE_URL,
  PHONE_NUMBER,
  STUDIO_ADDRESS
};
