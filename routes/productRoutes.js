const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, admin, vendor } = require('../middleware/authMiddleware');

// Admin/Vendor routes
router.get('/admin/list', protect, vendor, productController.getAdminProducts);
router.get('/admin/low-stock', protect, vendor, productController.getLowStockProducts);
router.put('/admin/:id/toggle-visibility', protect, vendor, productController.toggleProductVisibility);

// Public routes
router.get('/featured', productController.getFeaturedProducts);
router.get('/new', productController.getNewProducts);
router.get('/categories', productController.getCategories);
router.get('/category/:category', productController.getProductsByCategory);

// Protected routes (requires login)
router.post('/:id/wishlist', protect, productController.addToWishlist);
router.delete('/:id/wishlist', protect, productController.removeFromWishlist);

// Product CRUD routes
router.route('/')
  .get(productController.getProducts)
  .post(protect, vendor, productController.createProduct);

router.route('/:id')
  .get(productController.getProduct)
  .put(protect, vendor, productController.updateProduct)
  .delete(protect, vendor, productController.deleteProduct);

module.exports = router;
