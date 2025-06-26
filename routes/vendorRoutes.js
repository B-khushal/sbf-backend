const express = require('express');
const router = express.Router();
const {
    registerVendor,
    getVendorProfile,
    updateVendorProfile,
    getVendorDashboard,
    getVendorProducts,
    getVendorOrders,
    getVendorAnalytics,
    getVendorPayouts,
    getAllVendors,
    updateVendorStatus
} = require('../controllers/vendorController');
const { protect, admin } = require('../middleware/authMiddleware');

// Vendor registration and profile routes
router.post('/register', protect, registerVendor);
router.get('/profile', protect, getVendorProfile);
router.put('/profile', protect, updateVendorProfile);

// Vendor dashboard and data routes
router.get('/dashboard', protect, getVendorDashboard);
router.get('/products', protect, getVendorProducts);
router.get('/orders', protect, getVendorOrders);
router.get('/analytics', protect, getVendorAnalytics);
router.get('/payouts', protect, getVendorPayouts);

// Admin routes for vendor management
router.get('/admin/all', protect, admin, getAllVendors);
router.put('/admin/:id/status', protect, admin, updateVendorStatus);

module.exports = router;