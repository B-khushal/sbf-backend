const express = require("express");
const router = express.Router();
const {
  addReviewReply,
  getAdminReviewAnalytics,
  getAdminReviews,
  moderateReview,
  toggleReviewLike,
  updateReview,
  deleteReview,
  respondToReview,
  getUserReviews,
} = require("../controllers/reviewController");
const { protect, admin } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimiter");

// @route   GET /api/reviews/my-reviews
// @desc    Get current user's reviews
// @access  Private
router.get("/my-reviews", protect, getUserReviews);

router.get(
  "/admin",
  protect,
  admin,
  createRateLimiter({
    windowMs: 60 * 1000,
    max: 90,
    message: "Too many admin review requests. Please pause for a moment.",
  }),
  getAdminReviews
);

router.get(
  "/admin/analytics",
  protect,
  admin,
  createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: "Too many analytics requests. Please pause for a moment.",
  }),
  getAdminReviewAnalytics
);

router.post(
  "/:id/likes",
  protect,
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 80,
    message: "Too many helpful reactions. Please try again later.",
  }),
  toggleReviewLike
);

router.post(
  "/:id/vote",
  protect,
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 80,
    message: "Too many helpful reactions. Please try again later.",
  }),
  toggleReviewLike
);

router.post(
  "/:id/replies",
  protect,
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many replies. Please wait before posting another one.",
  }),
  addReviewReply
);

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private (Own reviews only)
router.put(
  "/:id",
  protect,
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many review edits. Please wait before editing again.",
  }),
  updateReview
);

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
// @access  Private (Own reviews or admin)
router.delete("/:id", protect, deleteReview);

router.patch(
  "/:id/moderation",
  protect,
  admin,
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 80,
    message: "Too many moderation actions. Please wait a moment.",
  }),
  moderateReview
);

// @route   POST /api/reviews/:id/respond
// @desc    Admin/Vendor respond to review
// @access  Private (Admin/Vendor only)
router.post(
  "/:id/respond",
  protect,
  createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many replies. Please wait before posting another one.",
  }),
  respondToReview
);

module.exports = router; 
