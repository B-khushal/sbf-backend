const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getTopProducts,
  getFeaturedProducts,
  getNewProducts,
  getAdminProducts,
  toggleProductVisibility,
  getLowStockProducts,
  getProductCategories,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const mongoose = require('mongoose');

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
  .post(protect, admin, createProduct);

router.get('/top', getTopProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new', getNewProducts);
router.get('/categories', getProductCategories);

router.route('/:id')
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router.route('/:id/reviews').post(protect, createProductReview);

// Admin routes for product management
router.get('/admin/list', protect, admin, getAdminProducts);
router.put('/admin/:id/toggle-visibility', protect, admin, toggleProductVisibility);
router.get('/admin/low-stock', protect, admin, getLowStockProducts);

module.exports = router;
