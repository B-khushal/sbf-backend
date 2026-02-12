const express = require('express');
const router = express.Router();
const {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  deactivateDeviceToken,
  testPushNotification,
  cleanupOldTokens
} = require('../controllers/deviceTokenController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes - none, all routes require authentication

// Protected routes - require authentication
router.post('/register', protect, registerDeviceToken);
router.get('/', protect, getUserDeviceTokens);
router.delete('/:id', protect, deleteDeviceToken);
router.put('/:id/deactivate', protect, deactivateDeviceToken);
router.post('/test', testPushNotification); // No auth required for testing

// Admin only routes
router.post('/cleanup', protect, admin, cleanupOldTokens);

module.exports = router;
