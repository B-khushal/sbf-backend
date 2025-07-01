const Product = require("../models/Product");
const User = require('../models/User');
const Order = require('../models/Order');
const cloudinary = require('../config/cloudinary');

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
    const { 
      category,
      search,
      minPrice,
      maxPrice,
      sortBy,
      page = 1,
      limit = 10,
      featured,
      new: isNew,
      vendor
    } = req.query;

    const query = {};

    // Apply filters
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (featured) query.featured = featured === 'true';
    if (isNew) query.isNew = isNew === 'true';
    if (vendor) query.vendor = vendor;

    // Count total documents for pagination
    const total = await Product.countDocuments(query);

    // Apply sorting
    let sortOptions = {};
    if (sortBy) {
      switch (sortBy) {
        case 'price_asc':
          sortOptions.price = 1;
          break;
        case 'price_desc':
          sortOptions.price = -1;
          break;
        case 'newest':
          sortOptions.createdAt = -1;
          break;
        case 'oldest':
          sortOptions.createdAt = 1;
          break;
        default:
          sortOptions.createdAt = -1;
      }
    } else {
      sortOptions.createdAt = -1; // Default sort by newest
    }

    // Get paginated products
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('vendor', 'name email');

    res.json({
      products,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'name email');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error in getProduct:', error);
    res.status(500).json({ message: 'Error fetching product' });
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
      countInStock,
      images,
      featured,
      isNew,
      details,
      discount
    } = req.body;

    // Create product
    const product = new Product({
      title,
      description,
      price,
      category,
      countInStock,
      images,
      featured,
      isNew,
      details,
      discount,
      vendor: req.user.isAdmin ? null : req.user._id
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
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
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user has permission to update
    if (!req.user.isAdmin && (!product.vendor || product.vendor.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(updatedProduct);
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
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user has permission to delete
    if (!req.user.isAdmin && (!product.vendor || product.vendor.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    // Delete product images from cloudinary
    if (product.images && product.images.length > 0) {
      for (const imageUrl of product.images) {
        const publicId = imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await product.deleteOne();
    res.json({ message: 'Product deleted' });
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
    const products = await Product.find({ featured: true })
      .limit(6)
      .populate('vendor', 'name email');
    res.json(products);
  } catch (error) {
    console.error('Error in getFeaturedProducts:', error);
    res.status(500).json({ message: 'Error fetching featured products' });
  }
};

// @desc    Get new products
// @route   GET /api/products/new
// @access  Public
const getNewProducts = async (req, res) => {
  try {
    const products = await Product.find({ isNew: true })
      .limit(6)
      .populate('vendor', 'name email');
    res.json(products);
  } catch (error) {
    console.error('Error in getNewProducts:', error);
    res.status(500).json({ message: 'Error fetching new products' });
  }
};

// @desc    Get admin products
// @route   GET /api/products/admin/list
// @access  Private/Admin
const getAdminProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const query = req.user.isAdmin ? {} : { vendor: req.user._id };
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('vendor', 'name email');

    res.json({
      products,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error in getAdminProducts:', error);
    res.status(500).json({ message: 'Error fetching admin products' });
  }
};

// @desc    Toggle product visibility
// @route   PUT /api/products/admin/:id/toggle-visibility
// @access  Private/Admin
const toggleProductVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user has permission to update
    if (!req.user.isAdmin && (!product.vendor || product.vendor.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    product.isHidden = !product.isHidden;
    await product.save();

    res.json(product);
  } catch (error) {
    console.error('Error in toggleProductVisibility:', error);
    res.status(500).json({ message: 'Error toggling product visibility' });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/admin/low-stock
// @access  Private/Admin
const getLowStockProducts = async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { vendor: req.user._id };
    query.countInStock = { $lte: 10 };

    const products = await Product.find(query)
      .sort({ countInStock: 1 })
      .populate('vendor', 'name email');

    res.json(products);
  } catch (error) {
    console.error('Error in getLowStockProducts:', error);
    res.status(500).json({ message: 'Error fetching low stock products' });
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const query = { category };
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('vendor', 'name email');

    res.json({
      products,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error in getProductsByCategory:', error);
    res.status(500).json({ message: 'Error fetching products by category' });
  }
};

// @desc    Add product to wishlist
// @route   POST /api/products/:id/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const productId = req.params.id;

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.json({ message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(500).json({ message: 'Error adding product to wishlist' });
  }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/products/:id/wishlist
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const productId = req.params.id;

    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    res.json({ message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({ message: 'Error removing product from wishlist' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getTopProducts,
  getFeaturedProducts,
  getNewProducts,
  getAdminProducts,
  toggleProductVisibility,
  getLowStockProducts,
  getCategories,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
};