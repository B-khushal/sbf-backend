const Product = require("../models/Product");
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const mongoose = require('mongoose');

// Helper function to clean product data before saving
const cleanProductData = (product) => {
  const cleaned = product.toObject ? product.toObject() : product;
  
  // Remove any nested user objects from reviews
  if (cleaned.reviews && Array.isArray(cleaned.reviews)) {
    cleaned.reviews = cleaned.reviews.map(review => ({
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt
    }));
  }
  
  return cleaned;
};

// Helper function to add real review statistics to products
const addReviewStats = async (products) => {
  if (!products || products.length === 0) return products;
  
  const productArray = Array.isArray(products) ? products : [products];
  const productIds = productArray.map(p => p._id);
  
  try {
    // 🚀 Single aggregation query for ALL products at once
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
    ]);

    // Create a lookup map for O(1) access
    const statsMap = new Map();
    reviewStats.forEach(stat => {
      statsMap.set(stat._id.toString(), {
        numReviews: stat.totalReviews,
        rating: Math.round(stat.averageRating * 10) / 10
      });
    });

    // Apply stats to products
    productArray.forEach(product => {
      const stats = statsMap.get(product._id.toString());
      if (stats) {
        product.rating = stats.rating;
        product.numReviews = stats.numReviews;
      } else {
        product.rating = 0;
        product.numReviews = 0;
      }
    });

    return Array.isArray(products) ? productArray : productArray[0];
  } catch (error) {
    console.error('❌ Error calculating review stats:', error);
    // Fallback: return products with default stats
    productArray.forEach(product => {
      product.rating = product.rating || 0;
      product.numReviews = product.numReviews || 0;
    });
    return Array.isArray(products) ? productArray : productArray[0];
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.page) || 1;
    const category = req.query.category;
    const search = req.query.search;
    const sort = req.query.sort || '-createdAt';
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);

    // Build query
    const query = { hidden: { $ne: true } };

    // Add category filter if provided
    if (category) {
      query.category = category;
    }

    // Add search filter if provided
    if (search) {
      query.$text = { $search: search };
    }

    // Add price range filter if provided
    if (!isNaN(minPrice) || !isNaN(maxPrice)) {
      query.price = {};
      if (!isNaN(minPrice)) query.price.$gte = minPrice;
      if (!isNaN(maxPrice)) query.price.$lte = maxPrice;
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sort)
      .select('title images price category discount isFeatured isNew')
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .lean();

    res.json({
      products,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'name email')
      .lean();

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error in getProductById:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      categories,
      countInStock,
      images,
      isFeatured,
      isNew,
      discount,
      details,
      vendor,
      tags,
      seoTitle,
      seoDescription,
      seoKeywords
    } = req.body;

    const product = new Product({
      title,
      description,
      price,
      category,
      categories: categories || [],
      countInStock,
      images,
      isFeatured: isFeatured || false,
      isNew: isNew || false,
      discount: discount || 0,
      details: details || {},
      vendor,
      tags: tags || [],
      seoTitle,
      seoDescription,
      seoKeywords: seoKeywords || []
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error in createProduct:', error);
    res.status(500).json({ message: 'Error creating product' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      categories,
      countInStock,
      images,
      isFeatured,
      isNew,
      discount,
      details,
      vendor,
      tags,
      seoTitle,
      seoDescription,
      seoKeywords
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      product.title = title || product.title;
      product.description = description || product.description;
      product.price = price || product.price;
      product.category = category || product.category;
      product.categories = categories || product.categories;
      product.countInStock = countInStock || product.countInStock;
      product.images = images || product.images;
      product.isFeatured = isFeatured !== undefined ? isFeatured : product.isFeatured;
      product.isNew = isNew !== undefined ? isNew : product.isNew;
      product.discount = discount !== undefined ? discount : product.discount;
      product.details = details || product.details;
      product.vendor = vendor || product.vendor;
      product.tags = tags || product.tags;
      product.seoTitle = seoTitle || product.seoTitle;
      product.seoDescription = seoDescription || product.seoDescription;
      product.seoKeywords = seoKeywords || product.seoKeywords;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error in updateProduct:', error);
    res.status(500).json({ message: 'Error updating product' });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({ message: 'Error deleting product' });
  }
};

// @desc    Get top products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = async (req, res) => {
  try {
    const products = await Product.find({ hidden: { $ne: true } })
      .sort({ price: -1 })
      .limit(3)
      .lean();
    res.json(products);
  } catch (error) {
    console.error('Error in getTopProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, hidden: { $ne: true } })
      .select('title images price category discount')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    res.json(products);
  } catch (error) {
    console.error('Error in getFeaturedProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get new products
// @route   GET /api/products/new
// @access  Public
const getNewProducts = async (req, res) => {
  try {
    const products = await Product.find({ isNew: true, hidden: { $ne: true } })
      .select('title images price category discount')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    res.json(products);
  } catch (error) {
    console.error('Error in getNewProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get admin products
// @route   GET /api/products/admin/list
// @access  Private/Admin
const getAdminProducts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.page) || 1;

    const count = await Product.countDocuments({});
    const products = await Product.find({})
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .lean();

    res.json({
      products,
      page,
      pages: Math.ceil(count / pageSize),
    });
  } catch (error) {
    console.error('Error in getAdminProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Toggle product visibility
// @route   PUT /api/products/admin/:id/toggle-visibility
// @access  Private/Admin
const toggleProductVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      product.hidden = !product.hidden;
      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error in toggleProductVisibility:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/admin/low-stock
// @access  Private/Admin
const getLowStockProducts = async (req, res) => {
  try {
    const threshold = 5; // Define low stock threshold
    const products = await Product.find({ countInStock: { $lte: threshold } })
      .sort({ countInStock: 1 })
      .lean();
    res.json(products);
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getProductCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { hidden: { $ne: true } });
    res.json(categories);
  } catch (error) {
    console.error('Error in getProductCategories:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.page) || 1;
    const category = req.params.category;

    const count = await Product.countDocuments({
      category,
      hidden: { $ne: true }
    });

    const products = await Product.find({
      category,
      hidden: { $ne: true }
    })
      .select('title images price category discount')
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .lean();

    res.json({
      products,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error('Error in getProductsByCategory:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/products/:id/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user.wishlist.includes(product._id)) {
      user.wishlist.push(product._id);
      await user.save();
    }

    res.json({ message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/products/:id/wishlist
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== req.params.id
    );
    await user.save();

    res.json({ message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
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
};