const express = require('express');
const router = express.Router();
const {
    applyVendor,
    approveVendor,
    registerVendor,
    getVendorProfile,
    updateVendorProfile,
    getVendorDashboard,
    getVendorProducts,
    getVendorOrders,
    getVendorAnalytics,
    getVendorPayouts,
    getAllVendors,
    updateVendorStatus,
    getVendorPdf,
    deleteVendor
} = require('../controllers/vendorController');
const { protect, admin } = require('../middleware/authMiddleware');

// Vendor registration and profile routes
router.post('/apply', protect, applyVendor);
router.get('/consent-data', protect, require('../controllers/vendorController').getVendorConsentData);
router.post('/register', protect, registerVendor);
router.get('/profile', protect, getVendorProfile);
router.put('/profile', protect, updateVendorProfile);
router.get('/settings', protect, require('../controllers/vendorController').getVendorSettings);
router.put('/settings', protect, require('../controllers/vendorController').updateVendorSettings);

// Vendor dashboard and data routes
router.get('/dashboard', protect, getVendorDashboard);
router.get('/products', protect, getVendorProducts);
router.get('/orders', protect, getVendorOrders);
router.get('/analytics', protect, getVendorAnalytics);
router.get('/payouts', protect, getVendorPayouts);
router.get('/notifications', protect, require('../controllers/vendorController').getVendorNotifications);

// Admin routes for vendor management
router.get('/admin/all', protect, admin, getAllVendors);
router.get('/admin/:id', protect, admin, require('../controllers/vendorController').getVendorById);
router.put('/admin/:id/status', protect, admin, updateVendorStatus);
router.put('/admin/:id/approve', protect, admin, approveVendor);
router.delete('/admin/:id', protect, admin, deleteVendor);

// Public route to view generated PDFs
router.get('/pdf/:id/:type', getVendorPdf);

module.exports = router;