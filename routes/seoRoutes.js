const express = require('express');
const router = express.Router();
const {
  generateSitemapXml,
  generateSitemapIndexXml,
  generatePagesSitemapXml,
  generateCategoriesSitemapXml,
  generateProductsSitemapXml,
  generateOccasionsSitemapXml,
  generateBlogSitemapXml,
  generateFullSitemapXml,
  invalidateSitemapCache,
  generateRobotsTxt,
  renderCrawlerHtml,
  renderSitemapUiHtml,
  getSitemapData
} = require('../services/seoService');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getSeoOverviewStats,
  getProductsSeoList,
  updateProductSeo,
  generateProductSeoSingle,
  bulkGenerateSeo,
  getCategoriesSeoList,
  updateCategorySeo,
  bulkGenerateCategoriesSeo,
  exportSeoCsv,
  importSeoCsv,
  getValentineCalendarData,
  getPublicGlobalSeoSettings,
  updateAdminGlobalSeoSettings,
  getPublicBlogs,
  getPublicBlogBySlug,
  getAdminBlogs,
  createAdminBlog,
  updateAdminBlog,
  deleteAdminBlog,
  getAdminSeoHealthAudit,
  getAdminKeywordMappings,
  syncAdminKeywordMappings,
  saveAdminKeywordMapping,
  removeAdminKeywordMapping,
  exportAdminKeywordMappingsCsv,
  importAdminKeywordMappingsCsv,
  getAdminBacklinks,
  saveAdminBacklink,
  removeAdminBacklink,
  getAdminSeoPerformance
} = require('../controllers/seoController');

// Helper to send XML responses
const sendXmlResponse = (res, xml) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(xml);
};

// Helper to send HTML UI responses
const sendHtmlResponse = (res, html) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
  return res.status(200).send(html);
};

// Check if an explicit HTML UI view was requested via query param (?format=html)
// XML endpoints must ALWAYS return XML regardless of User-Agent or Accept header (no cloaking)
const isExplicitHtmlRequest = (req) => {
  return req.query.format === 'html';
};

// @desc    Human-readable Interactive Sitemap UI Routes
// @route   GET /sitemap, /site-map, /sitemap/:section
// @access  Public
router.get(['/sitemap', '/site-map', '/sitemap/:section'], async (req, res) => {
  try {
    const section = (req.params.section || '').toLowerCase();
    let type = 'index';
    if (section === 'pages' || section === 'static') type = 'pages';
    else if (section === 'categories') type = 'categories';
    else if (section === 'products') type = 'products';
    else if (section === 'occasions') type = 'occasions';
    else if (section === 'blog' || section === 'blogs') type = 'blog';

    if (req.query.format === 'xml') {
      const xml = await generateSitemapXml(type);
      return sendXmlResponse(res, xml);
    }

    const html = await renderSitemapUiHtml(type);
    return sendHtmlResponse(res, html);
  } catch (error) {
    console.error('Error rendering human sitemap UI:', error);
    return res.status(500).send('Internal Server Error rendering sitemap UI');
  }
});

// @desc    Sitemap Data JSON API for Frontend UI & Mobile Clients
// @route   GET /api/seo/sitemap-data or /sitemap-data
// @access  Public
router.get(['/sitemap-data', '/api/seo/sitemap-data'], async (req, res) => {
  try {
    const type = req.query.type || 'index';
    const data = await getSitemapData(type);
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching sitemap JSON data:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Primary Sitemap Index (or full sitemap if ?format=full)
// @route   GET /api/seo/sitemap.xml or /sitemap.xml
// @access  Public
router.get(['/sitemap.xml', '/sitemap-index.xml'], async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('index');
      return sendHtmlResponse(res, html);
    }

    const format = req.query.format;
    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = format === 'full' || format === 'single'
      ? await generateFullSitemapXml(force)
      : await generateSitemapIndexXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating sitemap</error>');
  }
});

// @desc    Static & Location Pages Sitemap
// @route   GET /api/seo/sitemap-pages.xml or /sitemap-static.xml
// @access  Public
router.get(['/sitemap-pages.xml', '/sitemap-static.xml'], async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('pages');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generatePagesSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating pages sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating pages sitemap</error>');
  }
});

// @desc    Product Categories Sitemap
// @route   GET /api/seo/sitemap-categories.xml
// @access  Public
router.get('/sitemap-categories.xml', async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('categories');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateCategoriesSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating categories sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating categories sitemap</error>');
  }
});

// @desc    Individual Products Sitemap (with Google Image XML tags)
// @route   GET /api/seo/sitemap-products.xml
// @access  Public
router.get('/sitemap-products.xml', async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('products');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateProductsSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating products sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating products sitemap</error>');
  }
});

// @desc    Occasions Sitemap
// @route   GET /api/seo/sitemap-occasions.xml
// @access  Public
router.get('/sitemap-occasions.xml', async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('occasions');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateOccasionsSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating occasions sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating occasions sitemap</error>');
  }
});

// @desc    Blog & Guides Sitemap
// @route   GET /api/seo/sitemap-blog.xml
// @access  Public
router.get(['/sitemap-blog.xml', '/sitemap-blogs.xml'], async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('blog');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateBlogSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating blog sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating blog sitemap</error>');
  }
});

// @desc    Full Combined Sitemap
// @route   GET /api/seo/sitemap-full.xml
// @access  Public
router.get('/sitemap-full.xml', async (req, res) => {
  try {
    if (isExplicitHtmlRequest(req)) {
      const html = await renderSitemapUiHtml('index');
      return sendHtmlResponse(res, html);
    }

    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateFullSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating full sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating full sitemap</error>');
  }
});

// @desc    Invalidate Sitemap Cache
// @route   POST /api/seo/invalidate-cache
// @access  Public
router.post('/invalidate-cache', (req, res) => {
  invalidateSitemapCache();
  return res.status(200).json({ success: true, message: 'Sitemap cache invalidated successfully' });
});

// @desc    Dynamic Robots.txt
// @route   GET /api/seo/robots.txt or /robots.txt
// @access  Public
router.get('/robots.txt', (req, res) => {
  try {
    const robots = generateRobotsTxt();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24hr
    return res.status(200).send(robots);
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    return res.status(500).send('User-agent: *\nAllow: /\n');
  }
});

// @desc    Universal SEO HTML Prerender for search crawlers
// @route   GET /api/seo/render
// @access  Public
router.get('/render', async (req, res) => {
  try {
    const targetPath = req.query.path || '/';
    const html = await renderCrawlerHtml(targetPath);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error rendering crawler HTML:', error);
    return res.status(500).send('Internal Server Error rendering page');
  }
});

// @desc    Dynamic Valentine's Calendar and Seasonal Content API
// @route   GET /api/seo/valentine-calendar
// @access  Public
router.get('/valentine-calendar', getValentineCalendarData);

// @desc    Public Global SEO Settings & Blog Endpoints
// @route   GET /api/seo/global-settings, /api/seo/blogs, /api/seo/blogs/:slug
// @access  Public
router.get('/global-settings', getPublicGlobalSeoSettings);
router.get('/blogs', getPublicBlogs);
router.get('/blogs/:slug', getPublicBlogBySlug);

// ── Admin SEO Management Endpoints ─────────────────────────────────
router.get('/admin/stats', protect, admin, getSeoOverviewStats);
router.get('/admin/health', protect, admin, getAdminSeoHealthAudit);
router.get('/admin/global-settings', protect, admin, getPublicGlobalSeoSettings);
router.put('/admin/global-settings', protect, admin, updateAdminGlobalSeoSettings);
router.get('/admin/products', protect, admin, getProductsSeoList);
router.put('/admin/products/:id', protect, admin, updateProductSeo);
router.post('/admin/products/generate/:id', protect, admin, generateProductSeoSingle);
router.post('/admin/products/bulk-generate', protect, admin, bulkGenerateSeo);
router.get('/admin/categories', protect, admin, getCategoriesSeoList);
router.put('/admin/categories/:id', protect, admin, updateCategorySeo);
router.post('/admin/categories/bulk-generate', protect, admin, bulkGenerateCategoriesSeo);
router.get('/admin/blogs', protect, admin, getAdminBlogs);
router.post('/admin/blogs', protect, admin, createAdminBlog);
router.put('/admin/blogs/:id', protect, admin, updateAdminBlog);
router.delete('/admin/blogs/:id', protect, admin, deleteAdminBlog);
router.get('/admin/export-csv', protect, admin, exportSeoCsv);
router.post('/admin/import-csv', protect, admin, importSeoCsv);

// Keyword Mapping CRM Routes
router.get('/admin/keyword-mappings', protect, admin, getAdminKeywordMappings);
router.post('/admin/keyword-mappings/sync', protect, admin, syncAdminKeywordMappings);
router.get('/admin/keyword-mappings/export', protect, admin, exportAdminKeywordMappingsCsv);
router.post('/admin/keyword-mappings/import', protect, admin, importAdminKeywordMappingsCsv);
router.post('/admin/keyword-mappings', protect, admin, saveAdminKeywordMapping);
router.put('/admin/keyword-mappings/:id', protect, admin, saveAdminKeywordMapping);
router.delete('/admin/keyword-mappings/:id', protect, admin, removeAdminKeywordMapping);

// Backlink & Authority Tracker Routes
router.get('/admin/backlinks', protect, admin, getAdminBacklinks);
router.post('/admin/backlinks', protect, admin, saveAdminBacklink);
router.put('/admin/backlinks/:id', protect, admin, saveAdminBacklink);
router.delete('/admin/backlinks/:id', protect, admin, removeAdminBacklink);

// SEO & Conversion Performance Dashboard Route
router.get('/admin/performance', protect, admin, getAdminSeoPerformance);

module.exports = router;
