const express = require('express');
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

// All wishlist routes require authentication
router.use(protect);

// @route   GET /api/wishlist
// @desc    Get user's wishlist
// @access  Private
router.get('/', getWishlist);

// @route   POST /api/wishlist
// @desc    Add item to wishlist
// @access  Private
router.post('/', addToWishlist);

// @route   DELETE /api/wishlist/:productId
// @desc    Remove item from wishlist
// @access  Private
router.delete('/:productId', removeFromWishlist);

// @route   DELETE /api/wishlist
// @desc    Clear user's wishlist
// @access  Private
router.delete('/', clearWishlist);

module.exports = router; 