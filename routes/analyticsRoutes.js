const express = require('express');
const router = express.Router();
const {
  getRevenueAnalytics,
  getSalesAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getPerformanceAnalytics
} = require('../controllers/analyticsController');
const { protect, admin } = require('../middleware/authMiddleware');

// Revenue analytics
router.get('/revenue', protect, admin, getRevenueAnalytics);

// Sales analytics
router.get('/sales', protect, admin, getSalesAnalytics);

// Product analytics
router.get('/products', protect, admin, getProductAnalytics);

// User analytics
router.get('/users', protect, admin, getUserAnalytics);

// Performance analytics
router.get('/performance', protect, admin, getPerformanceAnalytics);

module.exports = router; 