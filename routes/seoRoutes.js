const express = require('express');
const router = express.Router();
const {
  generateSitemapXml,
  generateRobotsTxt,
  renderCrawlerHtml
} = require('../services/seoService');

// @desc    Dynamic XML Sitemap
// @route   GET /api/seo/sitemap.xml or /sitemap.xml
// @access  Public
router.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400'); // 1hr browser, 24hr CDN
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating dynamic sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error generating sitemap</error>');
  }
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
