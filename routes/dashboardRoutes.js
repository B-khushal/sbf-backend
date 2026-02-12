const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

// Dashboard statistics
router.get('/', protect, admin, dashboardController.getDashboardStats);

// Recent orders
router.get('/recent-orders', protect, admin, dashboardController.getRecentOrders);

// Top products
router.get('/top-products', protect, admin, dashboardController.getTopProducts);

// Sales data
router.get('/sales-data', protect, admin, dashboardController.getSalesData);

// Real-time notifications
router.get('/notifications', protect, admin, dashboardController.getNotifications);

// Real-time user activity
router.get('/user-activity', protect, admin, dashboardController.getUserActivity);

module.exports = router;