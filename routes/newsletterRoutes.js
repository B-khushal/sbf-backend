const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  subscribe,
  unsubscribe,
  getAllSubscribers
} = require('../controllers/newsletterController');

// Public routes
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

// Admin routes
router.get('/subscribers', protect, admin, getAllSubscribers);

module.exports = router; 