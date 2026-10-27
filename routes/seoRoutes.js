const express = require('express');
const router = express.Router();
const {
  generateSitemapXml,
  generateSitemapIndexXml,
  generatePagesSitemapXml,
  generateCategoriesSitemapXml,
  generateProductsSitemapXml,
  generateOccasionsSitemapXml,
  generateFullSitemapXml,
  invalidateSitemapCache,
  generateRobotsTxt,
  renderCrawlerHtml
} = require('../services/seoService');

// Helper to send XML responses
const sendXmlResponse = (res, xml) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(xml);
};

// @desc    Serve Sitemap XSL Stylesheet for browser UI/UX styling
// @route   GET /api/seo/sitemap.xsl or /sitemap.xsl
// @access  Public
router.get('/sitemap.xsl', (req, res) => {
  const path = require('path');
  res.setHeader('Content-Type', 'text/xsl; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res.sendFile(path.join(__dirname, '../public/sitemap.xsl'));
});

// @desc    Primary Sitemap Index (or full sitemap if ?format=full)
// @route   GET /api/seo/sitemap.xml or /sitemap.xml
// @access  Public
router.get(['/sitemap.xml', '/sitemap-index.xml'], async (req, res) => {
  try {
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
    const force = req.query.force === 'true' || req.query.refresh === '1';
    const xml = await generateOccasionsSitemapXml(force);
    return sendXmlResponse(res, xml);
  } catch (error) {
    console.error('Error generating occasions sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating occasions sitemap</error>');
  }
});

// @desc    Full Combined Sitemap
// @route   GET /api/seo/sitemap-full.xml
// @access  Public
router.get('/sitemap-full.xml', async (req, res) => {
  try {
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

module.exports = router;
