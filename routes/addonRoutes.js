const express = require('express');
const router = express.Router();
const {
  getAddons,
  getRecommendedAddons,
  createAddon,
  updateAddon,
  deleteAddon
} = require('../controllers/addonController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAddons);
router.post('/recommendations', getRecommendedAddons);

// Protected admin routes
router.post('/', protect, admin, createAddon);
router.put('/:id', protect, admin, updateAddon);
router.delete('/:id', protect, admin, deleteAddon);

module.exports = router;
