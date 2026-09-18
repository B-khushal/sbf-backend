const express = require('express');
const router = express.Router();
const {
  searchProducts,
  getSearchSuggestions,
  trackSearchEvent,
  getSearchAnalytics
} = require('../controllers/searchController');
const { protect, admin, optionalProtect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Rate limiter for search endpoints: 120 per minute
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many search requests. Please try again shortly.'
});

// @route   GET /api/search
// @desc    Perform full smart faceted search
// @access  Public
router.get('/', searchLimiter, searchProducts);

// @route   GET /api/search/suggestions
// @desc    Instant autocomplete suggestions
// @access  Public
router.get('/suggestions', searchLimiter, getSearchSuggestions);

// @route   POST /api/search/track
// @desc    Track click-throughs and conversions from search
// @access  Public / Optional Protect
router.post('/track', optionalProtect, trackSearchEvent);

// @route   GET /api/search/analytics
// @desc    Admin Popular Search Analytics Dashboard metrics
// @access  Private/Admin
router.get('/analytics', protect, admin, getSearchAnalytics);

module.exports = router;
