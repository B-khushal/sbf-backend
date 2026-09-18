const express = require('express');
const router = express.Router();
const {
  protect,
  marketingAccess,
  marketingHeadOnly,
  optionalProtect
} = require('../middleware/authMiddleware');

const {
  ingestEvents,
  stitchIdentity,
  getDashboardOverview,
  getLiveVisitors,
  getCustomers,
  getCustomerProfile,
  getCustomerJourney,
  getConversionFunnel,
  getProductAnalytics,
  getOccasionAnalytics,
  getCartIntelligence,
  getSearchIntelligence,
  getCampaigns,
  createCampaign,
  getAttribution,
  getSegments,
  createSegment,
  getCohortAnalysis,
  getRetention,
  getOpportunities,
  getEventsFeed,
  getSettings,
  updateSettings,
  getActivityLogs,
  exportReport
} = require('../controllers/marketingController');

// 1. Client Event Ingestion (Public & Non-blocking)
router.post('/events', ingestEvents);

// 2. Identity Stitching (Optional protect for logged in customers)
router.post('/stitch-identity', optionalProtect, stitchIdentity);

// 3. Marketing Intelligence Panel Routes (Protected by marketingAccess)
router.get('/dashboard', protect, marketingAccess, getDashboardOverview);
router.get('/live-visitors', protect, marketingAccess, getLiveVisitors);
router.get('/customers', protect, marketingAccess, getCustomers);
router.get('/customers/:id', protect, marketingAccess, getCustomerProfile);
router.get('/journeys/:id', protect, marketingAccess, getCustomerJourney);
router.get('/funnel', protect, marketingAccess, getConversionFunnel);
router.get('/products', protect, marketingAccess, getProductAnalytics);
router.get('/occasions', protect, marketingAccess, getOccasionAnalytics);
router.get('/cart-intelligence', protect, marketingAccess, getCartIntelligence);
router.get('/search', protect, marketingAccess, getSearchIntelligence);
router.get('/campaigns', protect, marketingAccess, getCampaigns);
router.get('/attribution', protect, marketingAccess, getAttribution);
router.get('/segments', protect, marketingAccess, getSegments);
router.get('/cohorts', protect, marketingAccess, getCohortAnalysis);
router.get('/retention', protect, marketingAccess, getRetention);
router.get('/opportunities', protect, marketingAccess, getOpportunities);
router.get('/events-feed', protect, marketingAccess, getEventsFeed);
router.get('/settings', protect, marketingAccess, getSettings);

// 4. Marketing Head Privileged Actions (Protected by marketingHeadOnly)
router.put('/settings', protect, marketingHeadOnly, updateSettings);
router.post('/campaigns', protect, marketingHeadOnly, createCampaign);
router.post('/segments', protect, marketingHeadOnly, createSegment);
router.get('/reports/export', protect, marketingHeadOnly, exportReport);
router.get('/activity-logs', protect, marketingHeadOnly, getActivityLogs);

module.exports = router;
