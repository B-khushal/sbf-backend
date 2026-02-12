const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getAllPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  applyPromoCode,
  getPromoCodeStats
} = require('../controllers/promoCodeController');

// Public routes (no authentication required)
// Validate promo code during checkout
router.post('/validate', validatePromoCode);

// Protected routes (authentication required)
router.use(protect);

// Apply promo code to order (for order processing)
router.post('/apply', applyPromoCode);

// Admin-only routes
router.use(admin);

// Get all promo codes with filtering and pagination
router.get('/', getAllPromoCodes);

// Get promo code statistics
router.get('/stats', getPromoCodeStats);

// Get single promo code by ID
router.get('/:id', getPromoCodeById);

// Create new promo code
router.post('/', createPromoCode);

// Update promo code
router.put('/:id', updatePromoCode);

// Delete promo code
router.delete('/:id', deletePromoCode);

module.exports = router; 