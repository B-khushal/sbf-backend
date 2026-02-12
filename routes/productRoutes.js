const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getTopProducts,
  getFeaturedProducts,
  getNewProducts,
  getAdminProducts,
  toggleProductVisibility,
  getLowStockProducts,
  getProductCategories,
  getCategoriesWithCounts,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
} = require('../controllers/productController');

const {
  createProductReview,
  getProductReviews,
} = require('../controllers/reviewController');
const { protect, admin, adminOrVendor } = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const path = require('path');
const { fixProductDetails } = require(path.join(__dirname, '../scripts/fixProductDetails'));
const fixVendorProducts = require('../scripts/fixVendorProducts');

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Debug route to check database connection and collection
router.get('/debug/connection', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      4: 'uninitialized'
    };
    
    const collection = mongoose.connection.collection('products');
    const count = await collection.countDocuments();
    
    res.json({
      connectionState: states[state],
      databaseName: mongoose.connection.name,
      collectionName: 'products',
      documentCount: count,
      connectionString: mongoose.connection.client.s.url
    });
  } catch (error) {
    console.error("Database connection debug error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Debug route to list all products
router.get('/debug/list', async (req, res) => {
  try {
    const products = await Product.find({});
    console.log("Total products in database:", products.length);
    console.log("Products:", products);
    res.json({ products });
  } catch (error) {
    console.error("Error listing products:", error);
    res.status(500).json({ message: "Error listing products" });
  }
});

router.route('/')
  .get(getProducts)
  .post(protect, adminOrVendor, createProduct);

router.get('/top', getTopProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new', getNewProducts);
router.get('/categories', getProductCategories);
router.get('/categories-with-counts', getCategoriesWithCounts);

router.route('/:id')
  .get(getProductById)
  .put(protect, adminOrVendor, updateProduct)
  .delete(protect, adminOrVendor, deleteProduct);

router.route('/:id/reviews')
  .get(getProductReviews)
  .post(protect, createProductReview);

// Admin routes for product management
router.get('/admin/list', protect, adminOrVendor, getAdminProducts);
router.put('/admin/:id/toggle-visibility', protect, adminOrVendor, toggleProductVisibility);
router.get('/admin/low-stock', protect, adminOrVendor, getLowStockProducts);

// @route   GET /api/products/category/:category
// @desc    Get products by category
// @access  Public
router.get('/category/:category', getProductsByCategory);

// @route   POST /api/products/fix-details
// @desc    Fix malformed product details (migration endpoint)
// @access  Private/Admin
router.post('/fix-details', protect, admin, async (req, res) => {
  try {
    console.log('🔧 Starting product details migration via API...');
    
    // Import the fix function
    await fixProductDetails();
    
    res.json({
      success: true,
      message: 'Product details migration completed successfully'
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// @route   POST /api/products/fix-vendor-products
// @desc    Fix products missing vendor field (migration endpoint)
// @access  Private/Admin
router.post('/fix-vendor-products', protect, admin, async (req, res) => {
  try {
    console.log('🔧 Starting vendor products migration via API...');
    
    await fixVendorProducts();
    
    res.json({
      success: true,
      message: 'Vendor products migration completed successfully'
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// @route   POST /api/products/:id/wishlist
// @desc    Add to wishlist
// @access  Private
router.route('/:id/wishlist').post(protect, addToWishlist);

// @route   DELETE /api/products/:id/wishlist
// @desc    Remove from wishlist
// @access  Private
router.route('/:id/wishlist').delete(protect, removeFromWishlist);

module.exports = router;
