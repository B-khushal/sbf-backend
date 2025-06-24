const Product = require("../models/Product");
const User = require('../models/User');

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

// @desc Fetch all products (with pagination and filtering)
// @route GET /api/products
// @access Public
const getProducts = async (req, res) => {
  try {
    const pageSize = 12;
    const page = Number(req.query.page) || 1;
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

    // Filter out hidden products for public API
    const query = { ...category, ...keyword, hidden: { $ne: true } };
    
    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    return res.json({ products, page, pages: Math.ceil(count / pageSize), total: count });
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

    return res.json(product);
  } catch (error) {
    console.error("❌ Invalid product ID:", error);
    return res.status(500).json({ message: "Invalid product ID" });
  }
};

// @desc Create a new product
// @route POST /api/products
// @access Private/Admin
const createProduct = async (req, res) => {
  try {
    console.log("🔄 Starting product creation...");
    console.log("👤 User Role:", req.user?.role);
    console.log("📝 Received Product Data:", JSON.stringify(req.body, null, 2));

    const { title, price, category, categories, countInStock, images, isFeatured, isNew, discount, description, hidden, careInstructions } = req.body;

    // Validate required fields
    if (!title || !price || !category || !countInStock || !images || images.length === 0 || !description) {
      console.log("❌ Missing required fields:", {
        title: !!title,
        price: !!price,
        category: !!category,
        countInStock: !!countInStock,
        images: images?.length > 0,
        description: !!description
      });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate user authentication
    if (!req.user || !req.user._id) {
      console.log("❌ No authenticated user found");
      return res.status(401).json({ message: "User authentication required" });
    }

    // Process details from frontend format to backend format
    let processedDetails = [];
    if (req.body.details) {
      if (Array.isArray(req.body.details)) {
        // Filter out empty strings and keep as simple array
        processedDetails = req.body.details.filter(detail => 
          detail && typeof detail === 'string' && detail.trim()
        );
      } else if (typeof req.body.details === 'object') {
        // If it's an object (from frontend form), convert to array format
        processedDetails = Object.values(req.body.details).filter(detail => detail && detail.trim());
      }
    }

    // Process categories - ensure it's an array and filter out empty values
    let processedCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        processedCategories = categories.filter(cat => cat && cat.trim());
      } else if (typeof categories === 'string') {
        processedCategories = [categories.trim()];
      }
    }

    console.log("📝 Processed categories:", processedCategories);

    // Create new product
    const product = new Product({
      user: req.user._id,
      title,
      category,
      categories: processedCategories,
      price,
      discount: discount || 0,
      countInStock,
      description: description || "",
      images,
      isFeatured: isFeatured || false,
      isNew: isNew || false,
      hidden: hidden !== undefined ? hidden : true,  // 🔒 Default to hidden unless explicitly set to false
      details: processedDetails,
      careInstructions: careInstructions || [],
    });

    console.log("📦 Product object before save:", JSON.stringify(product, null, 2));

    // Save the product
    const savedProduct = await product.save();
    console.log("✅ Product successfully saved to database:", JSON.stringify(savedProduct, null, 2));

    // Verify the product exists in database
    const verifiedProduct = await Product.findById(savedProduct._id);
    console.log("🔍 Verified product in database:", JSON.stringify(verifiedProduct, null, 2));

    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("❌ Error creating product:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code
    });
    res.status(500).json({ 
      message: "Server error while creating product",
      error: error.message,
      details: error.code === 11000 ? "Duplicate key error" : undefined
    });
  }
};

// @desc Update a product
// @route PUT /api/products/:id
// @access Private/Admin
const updateProduct = async (req, res) => {
  try {
    console.log("🔄 Starting product update...");
    console.log("📝 Request body:", req.body);
    console.log("🔑 Product ID:", req.params.id);

    const { title, price, discount, description, images, category, categories, countInStock, isFeatured, isNew, hidden, careInstructions } = req.body;
    
    // Process details from frontend format to backend format
    let processedDetails;
    if (req.body.details) {
      if (Array.isArray(req.body.details)) {
        // Filter out empty strings and keep as simple array
        processedDetails = req.body.details.filter(detail => 
          detail && typeof detail === 'string' && detail.trim()
        );
      } else if (typeof req.body.details === 'object') {
        // If it's an object (from frontend form), convert to array format
        processedDetails = Object.values(req.body.details).filter(detail => detail && detail.trim());
      }
    }

    // Process categories - ensure it's an array and filter out empty values
    let processedCategories;
    if (categories !== undefined) {
      if (Array.isArray(categories)) {
        processedCategories = categories.filter(cat => cat && cat.trim());
      } else if (typeof categories === 'string') {
        processedCategories = [categories.trim()];
      } else {
        processedCategories = [];
      }
    }

    console.log("📝 Processed categories:", processedCategories);

    const product = await Product.findById(req.params.id);

    if (!product) {
      console.log("❌ Product not found with ID:", req.params.id);
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("📦 Existing product data:", product);

    // Update fields
    product.title = title || product.title;
    product.price = price || product.price;
    product.discount = discount !== undefined ? discount : product.discount;
    product.description = description || product.description;
    product.images = images?.length ? images : product.images;
    product.category = category || product.category;
    product.countInStock = countInStock || product.countInStock;
    product.isFeatured = isFeatured !== undefined ? isFeatured : product.isFeatured;
    product.isNew = isNew !== undefined ? isNew : product.isNew;
    product.hidden = hidden !== undefined ? hidden : product.hidden;
    
    // Update categories if provided
    if (processedCategories !== undefined) {
      product.categories = processedCategories;
    }

    // Update details if provided
    if (processedDetails !== undefined) {
      product.details = processedDetails;
    }

    // Update care instructions if provided
    if (careInstructions !== undefined) {
      product.careInstructions = careInstructions;
    }

    console.log("📝 Updated product data before save:", product);

    // Force Mongoose to recognize changes
    product.markModified("discount");
    product.markModified("images");
    product.markModified("details");
    product.markModified("categories");

    const updatedProduct = await product.save();
    console.log("✅ Successfully saved updated product:", updatedProduct);

    return res.json(updatedProduct);
  } catch (error) {
    console.error("❌ Error updating product:", error);
    console.error("Error stack:", error.stack);
    return res.status(400).json({ message: "Failed to update product", error: error.message });
  }
};

// @desc Delete a product
// @route DELETE /api/products/:id
// @access Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: "Product not found" });

    await product.deleteOne();
    return res.json({ message: "Product removed" });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    return res.status(500).json({ message: "Error deleting product" });
  }
};

// @desc Create product review
// @route POST /api/products/:id/reviews
// @access Private
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: "Product not found" });

    const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
    if (alreadyReviewed) return res.status(400).json({ message: "Product already reviewed" });

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    return res.status(201).json({ message: "Review added" });
  } catch (error) {
    console.error("❌ Error adding review:", error);
    return res.status(400).json({ message: "Error adding review" });
  }
};

// @desc Get top-rated products
// @route GET /api/products/top
// @access Public
const getTopProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ rating: -1 }).limit(5);
    if (!products.length) return res.status(404).json({ message: "No top-rated products found" });

    return res.json({ products });
  } catch (error) {
    console.error("❌ Error fetching top products:", error);
    return res.status(500).json({ message: "Error fetching top products" });
  }
};

// @desc Get featured products
// @route GET /api/products/featured
// @access Public
const getFeaturedProducts = async (req, res) => {
  try {
    console.log("🔍 Fetching featured products...");
    const products = await Product.find({ isFeatured: true, hidden: { $ne: true } }).limit(8);
    console.log("✅ Found featured products:", products.length);
    
    if (!products.length) {
      console.log("⚠️ No featured products found");
      return res.status(404).json({ message: "No featured products found" });
    }

    return res.json({ products });
  } catch (error) {
    console.error("❌ Error fetching featured products:", error);
    return res.status(500).json({ message: "Error fetching featured products" });
  }
};

// @desc Get new arrival products
// @route GET /api/products/new
// @access Public
const getNewProducts = async (req, res) => {
  try {
    console.log("🔍 Fetching new products...");
    const products = await Product.find({ isNew: true, hidden: { $ne: true } }).limit(8);
    console.log("✅ Found new products:", products.length);
    
    if (!products.length) {
      console.log("⚠️ No new products found");
      return res.status(404).json({ message: "No new products found" });
    }

    return res.json({ products });
  } catch (error) {
    console.error("❌ Error fetching new products:", error);
    return res.status(500).json({ message: "Error fetching new products" });
  }
};

// @desc Get all products for admin (including hidden)
// @route GET /api/admin/products
// @access Private/Admin
const getAdminProducts = async (req, res) => {
  try {
    const pageSize = 50;
    const page = Number(req.query.page) || 1;
    const category = req.query.category ? { category: req.query.category } : {};

    // Search by title, description, category, or categories using regex (case-insensitive)
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

    // Admin query includes hidden products
    const query = { ...category, ...keyword };
    
    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    return res.json({ products, page, pages: Math.ceil(count / pageSize), total: count });
  } catch (error) {
    console.error("❌ Error fetching admin products:", error);
    return res.status(500).json({ message: "Server Error: Failed to fetch admin products" });
  }
};

// @desc Toggle product visibility
// @route PUT /api/admin/products/:id/toggle-visibility
// @access Private/Admin
const toggleProductVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.hidden = !product.hidden;
    const updatedProduct = await product.save();

    return res.json({
      message: `Product ${updatedProduct.hidden ? 'hidden' : 'shown'} successfully`,
      product: updatedProduct
    });
  } catch (error) {
    console.error("❌ Error toggling product visibility:", error);
    return res.status(500).json({ message: "Error toggling product visibility" });
  }
};

// @desc Get low stock products
// @route GET /api/products/admin/low-stock
// @access Private/Admin
const getLowStockProducts = async (req, res) => {
  try {
    const threshold = req.query.threshold || 5; // Default threshold is 5
    const lowStockProducts = await Product.find({
      countInStock: { $lte: threshold },
      hidden: { $ne: true } // Only show visible products
    }).select('title countInStock price images');

    res.json({
      success: true,
      products: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
      error: error.message
    });
  }
};

// @desc Get all unique product categories
// @route GET /api/products/categories
// @access Public
const getProductCategories = async (req, res) => {
  try {
    // Get all unique categories from visible products
    const categories = await Product.distinct('category', { hidden: { $ne: true } });
    
    // Filter out empty/null categories and sort alphabetically
    const validCategories = categories
      .filter(category => category && category.trim())
      .sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      categories: validCategories,
      count: validCategories.length
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// @desc Get products by category
// @route GET /api/products/category/:category
// @access Public
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.limit) || 10;
    
    console.log(`🔍 Fetching products for category: ${category}`);
    
    const query = {
      category: { $regex: category, $options: 'i' },
      hidden: { $ne: true }
    };
    
    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${products.length} products in category: ${category}`);
    
    res.json({
      success: true,
      products,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error('❌ Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products by category',
      error: error.message
    });
  }
};

// @desc Add product to wishlist
// @route POST /api/products/:id/wishlist
// @access Private
const addToWishlist = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;
    
    // For now, just return success (wishlist logic would need user model updates)
    res.json({
      success: true,
      message: 'Product added to wishlist',
      productId,
      userId
    });
  } catch (error) {
    console.error('❌ Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to wishlist',
      error: error.message
    });
  }
};

// @desc Remove product from wishlist
// @route DELETE /api/products/:id/wishlist
// @access Private
const removeFromWishlist = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;
    
    // For now, just return success (wishlist logic would need user model updates)
    res.json({
      success: true,
      message: 'Product removed from wishlist',
      productId,
      userId
    });
  } catch (error) {
    console.error('❌ Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing from wishlist',
      error: error.message
    });
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
  getLowStockProducts,
  getProductCategories,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
};
