const express = require('express');
const router = express.Router();
const {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  deactivateDeviceToken,
  testPushNotification,
  testPushNotificationById,
  testNotificationToAll,
  getAdminDeviceTokens,
  cleanupOldTokens,
  checkFCMStatus
} = require('../controllers/deviceTokenController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.post('/test', testPushNotification); // No auth required for backward compatibility

// Status check route (protected - admin only)
router.get('/fcm-status', protect, admin, checkFCMStatus);

// Protected routes - require authentication
router.post('/register', protect, registerDeviceToken);
router.get('/', protect, getUserDeviceTokens);
router.get('/admin-devices', protect, admin, getAdminDeviceTokens); // Get all admin devices
router.post('/test-by-id', protect, admin, testPushNotificationById); // Test specific device
router.post('/test-all', protect, admin, testNotificationToAll); // Test notification to ALL admin devices
router.delete('/:id', protect, deleteDeviceToken);
router.put('/:id/deactivate', protect, deactivateDeviceToken);

// Admin only routes
router.post('/cleanup', protect, admin, cleanupOldTokens);

module.exports = router;
