const express = require('express');
const router = express.Router();
const {
  getSocialFeedPosts,
  createSocialFeedPost,
  updateSocialFeedPost,
  deleteSocialFeedPost,
  reorderSocialFeedPosts,
} = require('../controllers/socialFeedController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route to fetch posts
router.get('/', getSocialFeedPosts);

// Admin-only protected routes
router.post('/', protect, admin, createSocialFeedPost);
router.put('/:id', protect, admin, updateSocialFeedPost);
router.delete('/:id', protect, admin, deleteSocialFeedPost);
router.patch('/reorder', protect, admin, reorderSocialFeedPosts);

module.exports = router;
