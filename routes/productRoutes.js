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
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
} = require('../controllers/productController');

const { protect, admin } = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { fixProductDetails } = require('../scripts/fixProductDetails');

// 🔧 CORS-friendly middleware for all product routes
router.use((req, res, next) => {
  // Enhanced CORS headers for product routes
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  // Handle preflight requests for this router
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // No cache for API endpoints
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ⚡ NEW: Optimized homepage data endpoint - reduces API calls from 2 to 1
// @route   GET /api/products/homepage-data
// @desc    Get all homepage data in one request (featured + new products)
// @access  Public
router.get('/homepage-data', async (req, res) => {
  try {
    console.time('homepage-data');
    
    // Parallel queries for both featured and new products
    const [featuredProducts, newProducts] = await Promise.all([
      Product.find({ isFeatured: true, hidden: { $ne: true } })
        .select('title images price category discount isFeatured isNew')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Product.find({ isNew: true, hidden: { $ne: true } })
        .select('title images price category discount isFeatured isNew')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean()
    ]);

    console.timeEnd('homepage-data');
    console.log(`✅ Homepage data loaded: ${featuredProducts.length} featured + ${newProducts.length} new products`);
    
    res.json({
      success: true,
      featured: featuredProducts,
      new: newProducts,
      meta: {
        featuredCount: featuredProducts.length,
        newCount: newProducts.length,
        totalProducts: [...featuredProducts, ...newProducts].length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching homepage data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching homepage data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
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
      success: true,
      connectionState: states[state],
      databaseName: mongoose.connection.name,
      collectionName: 'products',
      documentCount: count,
      connectionString: mongoose.connection.client?.s?.url?.replace(/\/\/.*@/, '//***:***@') || 'Not available'
    });
  } catch (error) {
    console.error("Database connection debug error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Debug route to list all products
router.get('/debug/list', async (req, res) => {
  try {
    const products = await Product.find({}).limit(10);
    console.log("Total products in database:", products.length);
    res.json({ 
      success: true,
      products: products.map(p => ({
        id: p._id,
        title: p.title,
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        hidden: p.hidden
      }))
    });
  } catch (error) {
    console.error("Error listing products:", error);
    res.status(500).json({ 
      success: false,
      message: "Error listing products",
      error: error.message 
    });
  }
});

// Main product routes
router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

router.get('/top', getTopProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new', getNewProducts);
router.get('/categories', getProductCategories);

router.route('/:id')
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

// Admin routes for product management
router.get('/admin/list', protect, admin, getAdminProducts);
router.put('/admin/:id/toggle-visibility', protect, admin, toggleProductVisibility);
router.get('/admin/low-stock', protect, admin, getLowStockProducts);

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

// Wishlist routes
router.post('/:id/wishlist', protect, addToWishlist);
router.delete('/:id/wishlist', protect, removeFromWishlist);

module.exports = router;
