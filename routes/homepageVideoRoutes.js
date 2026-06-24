const express = require('express');
const router = express.Router();
const homepageVideoController = require('../controllers/homepageVideoController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public route to fetch active videos for the homepage
router.get('/active', homepageVideoController.getActiveVideos);

// Protected admin routes for video management
router.get('/', protect, admin, homepageVideoController.getVideos);
router.post('/', protect, admin, homepageVideoController.createVideo);
router.patch('/reorder', protect, admin, homepageVideoController.reorderVideos);
router.patch('/status', protect, admin, homepageVideoController.updateStatus);

router.route('/:id')
  .put(protect, admin, homepageVideoController.updateVideo)
  .delete(protect, admin, homepageVideoController.deleteVideo);

router.patch('/:id/status', protect, admin, homepageVideoController.updateStatus);
router.patch('/:id/restore', protect, admin, homepageVideoController.restoreVideo);

module.exports = router;
