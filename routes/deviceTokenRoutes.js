const express = require('express');
const router = express.Router();
const {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  deactivateDeviceToken,
  testPushNotification,
  testPushNotificationById,
  getAdminDeviceTokens,
  cleanupOldTokens
} = require('../controllers/deviceTokenController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.post('/test', testPushNotification); // No auth required for backward compatibility

// Protected routes - require authentication
router.post('/register', protect, registerDeviceToken);
router.get('/', protect, getUserDeviceTokens);
router.get('/admin-devices', protect, getAdminDeviceTokens); // Get all admin devices
router.post('/test-by-id', protect, testPushNotificationById); // Test specific device
router.delete('/:id', protect, deleteDeviceToken);
router.put('/:id/deactivate', protect, deactivateDeviceToken);

// Admin only routes
router.post('/cleanup', protect, admin, cleanupOldTokens);

module.exports = router;
