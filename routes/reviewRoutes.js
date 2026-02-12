const express = require("express");
const router = express.Router();
const {
  createProductReview,
  getProductReviews,
  voteOnReview,
  updateReview,
  deleteReview,
  respondToReview,
  getUserReviews,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

// @route   GET /api/reviews/my-reviews
// @desc    Get current user's reviews
// @access  Private
router.get("/my-reviews", protect, getUserReviews);

// @route   POST /api/reviews/:id/vote
// @desc    Vote on review helpfulness
// @access  Private
router.post("/:id/vote", protect, voteOnReview);

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private (Own reviews only)
router.put("/:id", protect, updateReview);

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private (Own reviews or admin)
router.delete("/:id", protect, deleteReview);

// @route   POST /api/reviews/:id/respond
// @desc    Admin/Vendor respond to review
// @access  Private (Admin/Vendor only)
router.post("/:id/respond", protect, respondToReview);

module.exports = router; 