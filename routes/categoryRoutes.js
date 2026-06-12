const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkDelete,
  bulkStatusUpdate,
  resolveCategoryUrl,
} = require('../controllers/categoryController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getCategories);
router.get('/resolve', resolveCategoryUrl);
router.get('/:id', getCategoryById);

// Admin-only endpoints
router.post('/', protect, admin, createCategory);
router.put('/:id', protect, admin, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);
router.post('/bulk-delete', protect, admin, bulkDelete);
router.post('/bulk-status-update', protect, admin, bulkStatusUpdate);

module.exports = router;
