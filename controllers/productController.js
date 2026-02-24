const Product = require("../models/Product");
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Review = require('../models/Review');
const asyncHandler = require('express-async-handler');

// Helper function to clean product data before saving
const cleanProductData = (product) => {
  // Fix details field if it's malformed
  if (product.details && Array.isArray(product.details)) {
    const cleanedDetails = [];
    for (let detail of product.details) {
      if (typeof detail === 'string') {
        // Check if it's a malformed nested array string
        if (detail.startsWith('[') && detail.endsWith(']')) {
          try {
            const parsed = JSON.parse(detail);
            if (Array.isArray(parsed)) {
              // Flatten the nested array
              for (let item of parsed) {
                if (Array.isArray(item)) {
                  cleanedDetails.push(...item.filter(i => typeof i === 'string'));
                } else if (typeof item === 'string') {
                  cleanedDetails.push(item);
                }
              }
            } else {
              cleanedDetails.push(detail);
            }
          } catch (parseError) {
            cleanedDetails.push(detail);
          }
        } else {
          cleanedDetails.push(detail);
        }
      }
    }
    product.details = cleanedDetails;
  }

  // Fix careInstructions field if it's malformed
  if (product.careInstructions && Array.isArray(product.careInstructions)) {
    const cleanedCareInstructions = [];
    for (let instruction of product.careInstructions) {
      if (typeof instruction === 'string') {
        // Check if it's a malformed nested array string
        if (instruction.startsWith('[') && instruction.endsWith(']')) {
          try {
            const parsed = JSON.parse(instruction);
            if (Array.isArray(parsed)) {
              // Flatten the nested array
              for (let item of parsed) {
                if (Array.isArray(item)) {
                  cleanedCareInstructions.push(...item.filter(i => typeof i === 'string'));
                } else if (typeof item === 'string') {
                  cleanedCareInstructions.push(item);
                }
              }
            } else {
              cleanedCareInstructions.push(instruction);
            }
          } catch (parseError) {
            cleanedCareInstructions.push(instruction);
          }
        } else {
          cleanedCareInstructions.push(instruction);
        }
      }
    }
    product.careInstructions = cleanedCareInstructions;
  }

  return product;
};

// Helper function to add real review statistics to products
const addReviewStats = async (products) => {
  const productArray = Array.isArray(products) ? products : [products];
  
  for (let product of productArray) {
    // Get reviews for this product
    const reviews = await Review.find({ 
      product: product._id, 
      status: 'approved' 
    }).select('rating');
    
    // Calculate real statistics
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      product.rating = totalRating / reviews.length;
      product.numReviews = reviews.length;
    } else {
      product.rating = 0;
      product.numReviews = 0;
    }
  }
  
  return Array.isArray(products) ? productArray : productArray[0];
};

// @desc Fetch all products (with pagination and filtering)
// @route GET /api/products
// @access Public
const getProducts = async (req, res) => {
  try {
    // const pageSize = 12;
    // const page = Number(req.query.page) || 1;
    const category = req.query.category ? { category: req.query.category } : {};

    // ✅ Search by title, description, category, or categories using regex (case-insensitive)
    const keyword = req.query.search
    ? {
        $or: [
          { title: { $regex: req.query.search, $options: "i" } },
          { description: { $regex: req.query.search, $options: "i" } },
            { category: { $regex: req.query.search, $options: "i" } },
            { categories: { $elemMatch: { $regex: req.query.search, $options: "i" } } },
          { category: { $regex: req.query.search, $options: "i" } },
          { categories: { $elemMatch: { $regex: req.query.search, $options: "i" } } },
        ],
      }
    : {};

    // Only show visible products to customers (exclude hidden ones)
    // Also only show approved products to non-admin users (or products without status for backward compatibility)
    const query = { 
      ...category, 
      ...keyword, 
      hidden: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } } // Backward compatibility
      ]
    };
    
    const count = await Product.countDocuments(query);
    // Remove pagination: fetch all products
    const products = await Product.find(query)
      .sort({ createdAt: -1 });

    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);

    return res.json({ products: productsWithReviews, total: count });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    return res.status(500).json({ message: "Server Error: Failed to fetch products" });
  }
};

// @desc Fetch single product
// @route GET /api/products/:id
// @access Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    // Check if product is hidden and user is not admin
    if (product.hidden && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if product is not approved and user is not admin/vendor owner
    // Products without approval status are treated as approved (backward compatibility)
    if (product.approvalStatus && product.approvalStatus !== 'approved') {
      const isAuthorized = req.user && (
        req.user.role === 'admin' || 
        (req.user.role === 'vendor' && product.user.toString() === req.user._id.toString())
      );
      
      if (!isAuthorized) {
        return res.status(404).json({ message: "Product not found" });
      }
    }

    console.log('📋 Product from database:', {
      id: product._id,
      title: product.title,
      hasPriceVariants: product.hasPriceVariants,
      priceVariants: product.priceVariants,
      priceVariantsCount: product.priceVariants ? product.priceVariants.length : 'undefined'
    });

    // Add real review statistics
    const productWithReviews = await addReviewStats(product);

    console.log('📋 Product with reviews:', {
      id: productWithReviews._id,
      title: productWithReviews.title,
      hasPriceVariants: productWithReviews.hasPriceVariants,
      priceVariants: productWithReviews.priceVariants,
      priceVariantsCount: productWithReviews.priceVariants ? productWithReviews.priceVariants.length : 'undefined'
    });

    return res.json(productWithReviews);
  } catch (error) {
    console.error("❌ Invalid product ID:", error);
    return res.status(500).json({ message: "Invalid product ID" });
  }
};

// @desc Create a new product
// @route POST /api/products
// @access Private/Admin or Vendor
const createProduct = asyncHandler(async (req, res) => {
  console.log('🆕 Creating new product');
  
  const {
    title,
    description,
    price,
    discount,
    category,
    categories,
    countInStock,
    images,
    details,
    careInstructions,
    isNewArrival,
    isNew,
    isFeatured,
    hidden,
    isCustomizable,
    customizationOptions,
    hasPriceVariants,
    priceVariants,
    comboItems,
    comboName,
    comboDescription,
    comboSubcategory,
  } = req.body;

  // If user is a vendor, find their vendor profile and set it
  let vendorId = null;
  let approvalStatus = 'approved'; // Admin products are auto-approved
  
  if (req.user.role === 'vendor') {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (vendor) {
      vendorId = vendor._id;
      approvalStatus = 'pending'; // Vendor products need approval
    }
  }

  const product = new Product({
    user: req.user._id,
    vendor: vendorId,
    approvalStatus,
    title,
    description,
      price,
      discount: discount || 0,
    category,
    categories: categories || [],
      countInStock,
      images,
    details: details || [],
    careInstructions: careInstructions || [],
    isNew: typeof isNew === 'boolean' ? isNew : Boolean(isNewArrival),
      isFeatured: isFeatured || false,
    hidden: hidden || false,
    isCustomizable: isCustomizable || false,
    customizationOptions: customizationOptions || {},
    hasPriceVariants: hasPriceVariants ?? false,
    priceVariants: priceVariants ?? [],
      comboItems: comboItems || [],
    comboName: comboName || '',
    comboDescription: comboDescription || '',
    comboSubcategory: comboSubcategory || '',
  });

  console.log('📋 Product object before save:', {
    hasPriceVariants: product.hasPriceVariants,
    priceVariants: product.priceVariants,
    priceVariantsCount: product.priceVariants.length
  });

  const createdProduct = await product.save();
  
  console.log('✅ Product created successfully:', {
    hasPriceVariants: createdProduct.hasPriceVariants,
    priceVariants: createdProduct.priceVariants,
    priceVariantsCount: createdProduct.priceVariants.length
  });
  
  res.status(201).json(createdProduct);
});

// @desc Update a product
// @route PUT /api/products/:id
// @access Private/Admin or Vendor (own products only)
const updateProduct = asyncHandler(async (req, res) => {
  
  const {
    title,
    description,
    price,
    discount,
    category,
    categories,
    countInStock,
    images,
    details,
    careInstructions,
    isNewArrival,
    isNew,
    isFeatured,
    hidden,
    isCustomizable,
    customizationOptions,
    hasPriceVariants,
    priceVariants,
    comboItems,
    comboName,
    comboDescription,
    comboSubcategory,
  } = req.body;

  const product = await Product.findById(req.params.id);

  if (product) {
    // Check authorization: vendors can only update their own products
    if (req.user.role === 'vendor' && product.user.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to update this product');
    }

    const resolvedIsNew = typeof isNew === 'boolean'
      ? isNew
      : (typeof isNewArrival === 'boolean' ? isNewArrival : product.isNew);

    const updateData = {
      title,
      description,
      price,
      discount: discount || 0,
      category,
      categories: categories || [],
      countInStock,
      images,
      details: details || [],
      careInstructions: careInstructions || [],
      isNew: resolvedIsNew,
      isFeatured: Boolean(isFeatured),
      hidden: Boolean(hidden),
      isCustomizable: Boolean(isCustomizable),
      customizationOptions: customizationOptions || {},
      hasPriceVariants: hasPriceVariants ?? false,
      priceVariants: Array.isArray(priceVariants) ? priceVariants : [],
      comboItems: comboItems || [],
      comboName: comboName || '',
      comboDescription: comboDescription || '',
      comboSubcategory: comboSubcategory || '',
    };

    // If vendor updates product, set to pending approval
    if (req.user.role === 'vendor') {
      updateData.approvalStatus = 'pending';
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Product not found');
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin or Vendor (own products only)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      // Check authorization: vendors can only delete their own products
      if (req.user.role === 'vendor' && product.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this product' });
      }
      
      await product.deleteOne();
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(504).json({ message: "Product not found" });
  }
};

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    console.log("🔍 Creating product review:", {
      productId: req.params.id,
      userId: req.user._id,
      rating: req.body.rating,
      comment: req.body.comment
    });

    const { rating, comment } = req.body;
    
    // Validate input
    if (!rating || !comment) {
      console.log("❌ Missing rating or comment");
      return res.status(400).json({ message: "Rating and comment are required" });
    }

    if (rating < 1 || rating > 5) {
      console.log("❌ Invalid rating:", rating);
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Check if product is hidden
    if (product.hidden) {
      console.log("❌ Cannot review hidden product:", req.params.id);
      return res.status(404).json({ message: "Product not found" });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      console.log("❌ User already reviewed this product");
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    // For demo purposes, allow reviews without purchase requirement
    // In production, you might want to check for purchase
    // const orders = await Order.find({
    //   user: req.user._id,
    //   "items.product": product._id,
    //   status: "delivered",
    // });
    // if (orders.length === 0) {
    //   return res.status(401).json({
    //     message: "You can only review products you have purchased.",
    //   });
    // }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment: comment.trim(),
      user: req.user._id,
      createdAt: new Date()
    };

    console.log("✅ Adding review:", review);

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    
    // Recalculate average rating
    const totalRating = product.reviews.reduce((acc, item) => item.rating + acc, 0);
    product.rating = totalRating / product.reviews.length;

    console.log("📊 Updated product stats:", {
      numReviews: product.numReviews,
      rating: product.rating
    });

    await product.save();
    
    console.log("✅ Review saved successfully");
    res.status(201).json({ 
      message: "Review added successfully",
      review: review,
      product: {
        numReviews: product.numReviews,
        rating: product.rating
      }
    });
  } catch (error) {
    console.error("❌ Error adding review:", error);
    res.status(500).json({ message: "Error adding review: " + error.message });
  }
};

// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      hidden: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } }
      ]
    }).sort({ rating: -1 }).limit(4);
    
    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);
    
    res.json(productsWithReviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top products' });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      isFeatured: true, 
      hidden: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } }
      ]
    })
      .sort({ createdAt: -1 }); // Removed .limit(8)
    console.log("Featured Products Query:", { isFeatured: true, hidden: { $ne: true }, approvalOrNoStatus: true });
    console.log("Fetched Featured Products:", products.map(p => ({ title: p.title, isFeatured: p.isFeatured })));
    
    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);
    
    res.json(productsWithReviews);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: "Error fetching featured products" });
  }
};

// @desc    Get new products
// @route   GET /api/products/new
// @access  Public
const getNewProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $and: [
        {
          $or: [
            { isNew: true },
            // Backward compatibility for legacy records
            { isNewArrival: true },
          ],
        },
        { hidden: { $ne: true } },
        {
          $or: [
            { approvalStatus: 'approved' },
            { approvalStatus: { $exists: false } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 }); // Removed .limit(8)
    console.log("Fetched New Products:", products.map(p => ({ title: p.title, isNew: p.isNew })));
    
    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);
    
    res.json(productsWithReviews);
  } catch (error) {
    console.error("Error fetching new products:", error);
    res.status(500).json({ message: 'Error fetching new products' });
  }
};

// @desc Get all products for admin (includes hidden)
// @route GET /api/products/admin/list
// @access Private/Admin or Vendor (vendors see only their products)
const getAdminProducts = async (req, res) => {
  try {
    // const pageSize = 15;
    // const page = Number(req.query.page) || 1;

    const keyword = req.query.search
      ? {
          $or: [
            { title: { $regex: req.query.search, $options: "i" } },
            { category: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    // Vendors can only see their own products
    const userFilter = req.user.role === 'vendor' 
      ? { user: req.user._id } 
      : {};

    const query = { ...keyword, ...userFilter };

    // No hidden filter for admin
    const count = await Product.countDocuments(query);
    // Remove pagination: fetch all products
    const products = await Product.find(query)
      .sort({ createdAt: -1 });

    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);

    res.json({ products: productsWithReviews, total: count });
  } catch (error) {
    console.error("Error fetching admin products:", error);
    res.status(500).json({ message: "Server Error: Failed to fetch admin products" });
  }
};

// @desc Toggle product visibility
// @route PUT /api/products/admin/:id/toggle-visibility
// @access Private/Admin or Vendor (vendors can only toggle their own products)
const toggleProductVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Check authorization: vendors can only toggle visibility of their own products
    if (req.user.role === 'vendor' && product.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to toggle visibility of this product' });
    }

    product.hidden = !product.hidden;
    await product.save();
    res.json({
      message: `Product visibility toggled to ${product.hidden ? 'hidden' : 'visible'}`,
      product
    });
  } catch (error) {
    console.error('Error toggling product visibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Toggle product new status
// @route PUT /api/products/admin/:id/toggle-new
// @access Private/Admin or Vendor (vendors can only toggle their own products)
const toggleProductNewStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Check authorization: vendors can only toggle "new" status of their own products
    if (req.user.role === 'vendor' && product.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    product.isNew = !product.isNew;
    await product.save();

    res.json({
      message: `Product marked as ${product.isNew ? 'new' : 'regular'}`,
      product,
    });
  } catch (error) {
    console.error('Error toggling product new status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get low stock products
// @route GET /api/products/admin/low-stock
// @access Private/Admin or Vendor (vendors see only their products)
const getLowStockProducts = async (req, res) => {
  try {
    const lowStockThreshold = 10;
    
    // Vendors can only see their own products
    const userFilter = req.user.role === 'vendor' 
      ? { user: req.user._id } 
      : {};

    const products = await Product.find({
      ...userFilter,
      countInStock: { $lte: lowStockThreshold },
    }).sort({ countInStock: 1 }); // Sort by lowest stock first
    res.json(products);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ message: 'Error fetching low stock products' });
  }
};

// @desc    Get all unique product categories
// @route   GET /api/products/categories
// @access  Public
const getProductCategories = async (req, res) => {
  try {
    // Use aggregation to get a clean list of unique, non-empty categories from visible products only
    const categories = await Product.aggregate([
      // Only include visible and approved products (or products without status)
      { $match: { 
        hidden: { $ne: true },
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } }
        ]
      } },
      // Unwind the categories array to de-normalize it
      { $unwind: "$categories" },
      // Group by the category name to get unique values
      { $group: { _id: "$categories" } },
      // Project to rename _id to name
      { $project: { name: "$_id", _id: 0 } },
      // Sort by name alphabetically
      { $sort: { name: 1 } }
    ]);
    
    // Extract just the name from the result objects
    const categoryNames = categories.map(cat => cat.name).filter(Boolean); // Filter out null/empty names
    
    res.json(categoryNames);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get categories with product counts
// @route   GET /api/products/categories-with-counts
// @access  Public
const getCategoriesWithCounts = async (req, res) => {
  try {
    // Get categories with counts using aggregation (only visible products)
    const categoriesWithCounts = await Product.aggregate([
      // Only include visible and approved products (or products without status)
      { $match: { 
        hidden: { $ne: true },
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } }
        ]
      } },
      // Unwind the categories array to de-normalize it
      { $unwind: "$categories" },
      // Group by category name and count products
      { 
        $group: { 
          _id: "$categories", 
          count: { $sum: 1 } 
        } 
      },
      // Project to rename _id to name
      { 
        $project: { 
          name: "$_id", 
          count: 1, 
          _id: 0 
        } 
      },
      // Sort by count descending, then by name
      { $sort: { count: -1, name: 1 } }
    ]);

    // Also get primary category counts (only visible products)
    const primaryCategoryCounts = await Product.aggregate([
      // Only include visible products
      { $match: { hidden: { $ne: true } } },
      // Group by primary category and count products
      { 
        $group: { 
          _id: "$category", 
          count: { $sum: 1 } 
        } 
      },
      // Project to rename _id to name
      { 
        $project: { 
          name: "$_id", 
          count: 1, 
          _id: 0 
        } 
      },
      // Sort by count descending, then by name
      { $sort: { count: -1, name: 1 } }
    ]);

    // Combine both results, prioritizing additional categories
    const combinedCounts = new Map();
    
    // Add primary category counts
    primaryCategoryCounts.forEach(item => {
      if (item.name) {
        combinedCounts.set(item.name.toLowerCase(), item.count);
      }
    });
    
    // Add or update with additional category counts
    categoriesWithCounts.forEach(item => {
      if (item.name) {
        const key = item.name.toLowerCase();
        const existingCount = combinedCounts.get(key) || 0;
        combinedCounts.set(key, existingCount + item.count);
      }
    });

    // Convert to array and sort
    const result = Array.from(combinedCounts.entries()).map(([name, count]) => ({
      name: name,
      count: count
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    res.json(result);
  } catch (error) {
    console.error("Error fetching categories with counts:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @route   GET /api/products/category/:category
// @desc    Get products by category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const pageSize = 12;
    const page = Number(req.query.page) || 1;

    // Check both primary category and additional categories, but only visible products
    const query = {
      $and: [
        {
          $or: [
            { category: { $regex: new RegExp(`^${category}$`, 'i') } },
            { categories: { $regex: new RegExp(`^${category}$`, 'i') } }
          ]
        },
        { hidden: { $ne: true } },
        {
          $or: [
            { approvalStatus: 'approved' },
            { approvalStatus: { $exists: false } }
          ]
        }
      ]
    };
    
    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    // Add real review statistics
    const productsWithReviews = await addReviewStats(products);

    res.json({ products: productsWithReviews, page, pages: Math.ceil(count / pageSize), total: count });
  } catch (error) {
    console.error(`Error fetching products for category ${req.params.category}:`, error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Add to wishlist
const addToWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const productId = req.params.id;
    
    // Check if product exists and is not hidden
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (product.hidden) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();
    res.status(200).json({ message: "Product added to wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const productId = req.params.id;
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    
    await user.save();
    res.status(200).json({ message: "Product removed from wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc Get pending products for approval
// @route GET /api/products/admin/pending-approval
// @access Private/Admin
const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ approvalStatus: 'pending' })
      .populate('user', 'name email')
      .populate('vendor', 'storeName')
      .sort({ createdAt: -1 });

    res.json({ products, total: products.length });
  } catch (error) {
    console.error('Error fetching pending products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Approve a product
// @route PUT /api/products/admin/:id/approve
// @access Private/Admin
const approveProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.approvalStatus = 'approved';
    product.rejectionReason = '';
    await product.save();

    res.json({ 
      message: 'Product approved successfully',
      product 
    });
  } catch (error) {
    console.error('Error approving product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Reject a product
// @route PUT /api/products/admin/:id/reject
// @access Private/Admin
const rejectProduct = async (req, res) => {
  try {
    const { reason } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.approvalStatus = 'rejected';
    product.rejectionReason = reason || 'No reason provided';
    await product.save();

    res.json({ 
      message: 'Product rejected',
      product 
    });
  } catch (error) {
    console.error('Error rejecting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
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
  toggleProductNewStatus,
  getLowStockProducts,
  getProductCategories,
  getCategoriesWithCounts,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
  getPendingProducts,
  approveProduct,
  rejectProduct,
};
