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

const {
  createProductReview,
  getProductReviews,
} = require('../controllers/reviewController');
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
    console.log('🔍 Homepage data request started');
    
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ Database not connected, state:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        fallback: true
      });
    }

    // Parallel queries for both featured and new products with timeout
    const queryTimeout = 10000; // 10 seconds timeout
    
    const [featuredProducts, newProducts] = await Promise.race([
      Promise.all([
        Product.find({ isFeatured: true, hidden: { $ne: true } })
          .select('title images price category rating numReviews discount isFeatured isNew')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
          .maxTimeMS(queryTimeout),
        Product.find({ isNew: true, hidden: { $ne: true } })
          .select('title images price category rating numReviews discount isFeatured isNew')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
          .maxTimeMS(queryTimeout)
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), queryTimeout)
      )
    ]);

    console.log(`✅ Products fetched: ${featuredProducts.length} featured, ${newProducts.length} new`);

    // Batch process review stats for all products at once
    const allProducts = [...featuredProducts, ...newProducts];
    
    if (allProducts.length > 0) {
      try {
        const Review = require('../models/Review');
        const productIds = allProducts.map(p => p._id);
        
        // Single aggregation query for all review stats with timeout
        const reviewStats = await Review.aggregate([
          {
            $match: { 
              product: { $in: productIds }, 
              status: 'approved' 
            }
          },
          {
            $group: {
              _id: '$product',
              totalReviews: { $sum: 1 },
              averageRating: { $avg: '$rating' }
            }
          }
        ]).maxTimeMS(5000); // 5 second timeout for review stats

        // Create lookup map for O(1) access
        const statsMap = new Map();
        reviewStats.forEach(stat => {
          statsMap.set(stat._id.toString(), {
            numReviews: stat.totalReviews,
            rating: Math.round(stat.averageRating * 10) / 10
          });
        });

        // Apply stats to all products
        allProducts.forEach(product => {
          const stats = statsMap.get(product._id.toString());
          if (stats) {
            product.rating = stats.rating;
            product.numReviews = stats.numReviews;
          } else {
            // Default values if no reviews
            product.rating = product.rating || 0;
            product.numReviews = product.numReviews || 0;
          }
        });

        console.log('✅ Review stats applied to products');
      } catch (reviewError) {
        console.log('⚠️ Review stats failed, using default values:', reviewError.message);
        // Continue without review stats - products will have default rating/numReviews
        allProducts.forEach(product => {
          product.rating = product.rating || 0;
          product.numReviews = product.numReviews || 0;
        });
      }
    }

    console.timeEnd('homepage-data');
    console.log(`✅ Homepage data loaded successfully`);
    
    res.json({
      success: true,
      featured: featuredProducts,
      new: newProducts,
      meta: {
        featuredCount: featuredProducts.length,
        newCount: newProducts.length,
        totalProducts: allProducts.length,
        timestamp: new Date().toISOString(),
        cached: false
      }
    });
  } catch (error) {
    console.error('❌ Error fetching homepage data:', error);
    
    // 🔧 FALLBACK: Return empty data instead of complete failure
    res.status(200).json({ 
      success: false,
      featured: [],
      new: [],
      message: 'Homepage data temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server temporarily unavailable',
      fallback: true,
      meta: {
        featuredCount: 0,
        newCount: 0,
        totalProducts: 0,
        timestamp: new Date().toISOString(),
        cached: false
      }
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

// 🔧 FIXED: Review routes with proper error handling
router.route('/:id/reviews')
  .get(getProductReviews)
  .post(protect, async (req, res, next) => {
    try {
      // Additional validation middleware for review creation
      console.log("🔍 Review creation attempt:", {
        productId: req.params.id,
        userId: req.user?._id,
        userAuth: !!req.user,
        hasRating: !!req.body.rating,
        hasComment: !!req.body.comment
      });

      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "You must be logged in to submit a review"
        });
      }

      // Validate product ID format
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format"
        });
      }

      // Call the review controller
      await createProductReview(req, res);
    } catch (error) {
      console.error("❌ Review route error:", error);
      res.status(500).json({
        success: false,
        message: "Error processing review submission",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

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

// Test route to verify reviews are working
router.get('/test/reviews', async (req, res) => {
  try {
    const Review = require('../models/Review');
    const reviewCount = await Review.countDocuments();
    const productCount = await Product.countDocuments();
    
    res.json({
      success: true,
      message: "Review system test",
      data: {
        totalReviews: reviewCount,
        totalProducts: productCount,
        databaseConnected: mongoose.connection.readyState === 1,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Review system test failed",
      error: error.message
    });
  }
});

module.exports = router;
