const express = require('express');
const router = express.Router();
const {
  getOccasions,
  getAdminOccasions,
  createOccasion,
  updateOccasion,
  deleteOccasion
} = require('../controllers/occasionController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.route('/')
  .get(getOccasions);

// Admin-only routes
router.route('/admin')
  .get(protect, admin, getAdminOccasions);

router.route('/')
  .post(protect, admin, createOccasion);

router.route('/:id')
  .put(protect, admin, updateOccasion)
  .delete(protect, admin, deleteOccasion);

module.exports = router;
