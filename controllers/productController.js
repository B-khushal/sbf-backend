const Product = require("../models/Product");
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');

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

    // Show all products in shop page (including hidden ones)
    const query = { ...category, ...keyword };
    
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

    // Add real review statistics
    const productWithReviews = await addReviewStats(product);

    return res.json(productWithReviews);
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
    console.log("🎁 Combo Data Check:", {
      category: req.body.category,
      comboItems: req.body.comboItems,
      comboName: req.body.comboName,
      comboDescription: req.body.comboDescription
    });

    const { title, price, category, categories, countInStock, images, isFeatured, isNew, discount, description, hidden, careInstructions, isCustomizable, customizationOptions, comboItems, comboName, comboDescription } = req.body;

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

    // Process customization options
    let processedCustomizationOptions = {
      allowPhotoUpload: false,
      allowNumberInput: false,
      numberInputLabel: "Enter number",
      allowMessageCard: false,
      messageCardPrice: 0,
      addons: {
        flowers: [],
        chocolates: []
      },
      previewImage: ""
    };

    if (customizationOptions) {
      processedCustomizationOptions = {
        allowPhotoUpload: Boolean(customizationOptions.allowPhotoUpload),
        allowNumberInput: Boolean(customizationOptions.allowNumberInput),
        numberInputLabel: customizationOptions.numberInputLabel || "Enter number",
        allowMessageCard: Boolean(customizationOptions.allowMessageCard),
        messageCardPrice: Number(customizationOptions.messageCardPrice) || 0,
        addons: {
          flowers: Array.isArray(customizationOptions.addons?.flowers) ? customizationOptions.addons.flowers : [],
          chocolates: Array.isArray(customizationOptions.addons?.chocolates) ? customizationOptions.addons.chocolates : []
        },
        previewImage: customizationOptions.previewImage || ""
      };
    }

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
      hidden: hidden !== undefined ? hidden : false,  // ✅ Default to visible unless explicitly set to true
      details: processedDetails,
      careInstructions: careInstructions || [],
      isCustomizable: Boolean(isCustomizable),
      customizationOptions: processedCustomizationOptions,
      // Combo-specific fields
      comboItems: comboItems || [],
      comboName: comboName || "",
      comboDescription: comboDescription || ""
    });

    console.log("📦 Product object before save:", JSON.stringify(product, null, 2));
    console.log("🎨 Customization data:", {
      isCustomizable: product.isCustomizable,
      customizationOptions: product.customizationOptions
    });
    console.log("🎁 Combo data before save:", {
      comboItems: product.comboItems,
      comboName: product.comboName,
      comboDescription: product.comboDescription
    });

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
    console.log("🎁 Update - Combo Data Check:", {
      category: req.body.category,
      comboItems: req.body.comboItems,
      comboName: req.body.comboName,
      comboDescription: req.body.comboDescription
    });

    const { title, price, discount, description, images, category, categories, countInStock, isFeatured, isNew, hidden, careInstructions, isCustomizable, customizationOptions, comboItems, comboName, comboDescription } = req.body;
    
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

    const product = await Product.findById(req.params.id);

    if (!product) {
      console.log("❌ Product not found for update");
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("📦 Current Product Data:", product);

    // Update fields
    product.title = title || product.title;
    product.price = price !== undefined ? price : product.price;
    product.discount = discount !== undefined ? discount : product.discount;
    product.description = description || product.description;
    product.images = images || product.images;
    product.category = category || product.category;
    product.categories = categories || product.categories;
    product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;
    product.isFeatured = isFeatured !== undefined ? isFeatured : product.isFeatured;
    product.isNew = isNew !== undefined ? isNew : product.isNew;
    product.hidden = hidden !== undefined ? hidden : product.hidden;
    product.details = processedDetails || product.details;
    product.careInstructions = careInstructions || product.careInstructions;
    
    // Update customization fields
    if (isCustomizable !== undefined) {
      product.isCustomizable = isCustomizable;
    }
    
    if (customizationOptions) {
      product.customizationOptions = {
        allowPhotoUpload: customizationOptions.allowPhotoUpload !== undefined ? customizationOptions.allowPhotoUpload : product.customizationOptions?.allowPhotoUpload || false,
        allowNumberInput: customizationOptions.allowNumberInput !== undefined ? customizationOptions.allowNumberInput : product.customizationOptions?.allowNumberInput || false,
        numberInputLabel: customizationOptions.numberInputLabel || product.customizationOptions?.numberInputLabel || "Enter number",
        allowMessageCard: customizationOptions.allowMessageCard !== undefined ? customizationOptions.allowMessageCard : product.customizationOptions?.allowMessageCard || false,
        messageCardPrice: customizationOptions.messageCardPrice !== undefined ? customizationOptions.messageCardPrice : product.customizationOptions?.messageCardPrice || 0,
        addons: {
          flowers: Array.isArray(customizationOptions.addons?.flowers) ? customizationOptions.addons.flowers : (product.customizationOptions?.addons?.flowers || []),
          chocolates: Array.isArray(customizationOptions.addons?.chocolates) ? customizationOptions.addons.chocolates : (product.customizationOptions?.addons?.chocolates || [])
        },
        previewImage: customizationOptions.previewImage || product.customizationOptions?.previewImage || ""
      };
    }
    
    // Update combo fields
    if (comboItems !== undefined) {
      product.comboItems = comboItems;
    }
    if (comboName !== undefined) {
      product.comboName = comboName;
    }
    if (comboDescription !== undefined) {
      product.comboDescription = comboDescription;
    }
    
    // Clean data before saving
    const cleanedProduct = cleanProductData(product);
    console.log("📦 Cleaned product data before save:", cleanedProduct);
    console.log("🎨 Customization data:", {
      isCustomizable: cleanedProduct.isCustomizable,
      customizationOptions: cleanedProduct.customizationOptions
    });

    // Save updated product
    const updatedProduct = await cleanedProduct.save();
    console.log("✅ Product updated successfully:", updatedProduct);

    res.json(updatedProduct);
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({ message: "Error updating product" });
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
      console.log("❌ Product not found:", req.params.id);
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
    const products = await Product.find({ hidden: { $ne: true } }).sort({ rating: -1 }).limit(4);
    
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
    const products = await Product.find({ isFeatured: true, hidden: { $ne: true } })
      .sort({ createdAt: -1 }); // Removed .limit(8)
    console.log("Featured Products Query:", { isFeatured: true, hidden: { $ne: true } });
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
    const products = await Product.find({ isNew: true, hidden: { $ne: true } })
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
// @access Private/Admin
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

    // No hidden filter for admin
    const count = await Product.countDocuments(keyword);
    // Remove pagination: fetch all products
    const products = await Product.find(keyword)
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
// @access Private/Admin
const toggleProductVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

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

// @desc Get low stock products
// @route GET /api/products/admin/low-stock
// @access Private/Admin
const getLowStockProducts = async (req, res) => {
  try {
    const lowStockThreshold = 10;
    const products = await Product.find({
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
    // Use aggregation to get a clean list of unique, non-empty categories
    const categories = await Product.aggregate([
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
    // Get categories with counts using aggregation
    const categoriesWithCounts = await Product.aggregate([
      // Include all products (including hidden ones)
      { $match: {} },
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

    // Also get primary category counts
    const primaryCategoryCounts = await Product.aggregate([
      // Include all products (including hidden ones)
      { $match: {} },
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

    // Check both primary category and additional categories
    const query = {
      $or: [
        { category: { $regex: new RegExp(`^${category}$`, 'i') } },
        { categories: { $regex: new RegExp(`^${category}$`, 'i') } }
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
  getCategoriesWithCounts,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
};