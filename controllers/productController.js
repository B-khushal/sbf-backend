const Product = require("../models/Product");
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Review = require('../models/Review');
const SectionSortingPreference = require('../models/SectionSortingPreference');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const prisma = require('../config/prisma');

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
    const query = { hidden: false };

    if (req.query.category) {
      const cat = req.query.category.trim();
      const catRegex = new RegExp(`^${cat}$`, 'i');
      query.$or = [
        { category: catRegex },
        { subcategory: catRegex },
        { categories: { $elemMatch: catRegex } }
      ];
    }

    let products = await Product.find(query);

    if (req.query.search) {
      const term = req.query.search.toLowerCase().trim();
      products = products.filter(p => 
        (p.title && p.title.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    }

    let section = 'shop';
    if (req.query.isValentineProduct === 'true' || req.query.productType === 'valentine') {
      section = 'valentine';
      products = products.filter(p => p.isValentineProduct || p.productType === 'valentine');
    } else if (req.query.category) {
      section = `category:${req.query.category}`;
    }

    products = await applySavedSortingToProducts(products, section);
    const productsWithReviews = await addReviewStats(products);

    return res.json({ products: productsWithReviews, total: productsWithReviews.length });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    return res.status(500).json({ message: "Server Error: Failed to fetch products" });
  }
};

const getProductById = async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    let product;

    // 1. Try finding directly by ID (handles both MongoDB ObjectIds and PostgreSQL prod_... string IDs)
    if (idOrSlug) {
      product = await Product.findById(idOrSlug);
    }

    // 2. If not found by direct ID, search by slug or title
    if (!product && idOrSlug) {
      product = await Product.findOne({ slug: idOrSlug });
    }

    if (!product && idOrSlug) {
      const terms = idOrSlug.split('-');
      const firstTerm = terms[0];
      
      if (firstTerm) {
        const candidates = await Product.find({
          $or: [
            { title: { $regex: new RegExp(firstTerm, 'i') } },
            { valentineSlug: idOrSlug }
          ]
        });

        const slugify = (text) => {
          return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
        };

        product = candidates.find(c => 
          slugify(c.title || c.name || '') === idOrSlug || c.valentineSlug === idOrSlug
        );
      }
    }

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
    console.error("❌ Error fetching product:", error);
    return res.status(500).json({ message: "Error fetching product details" });
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
    subcategory,
    categories,
    countInStock,
    images,
    videos,
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
    sameDay,
    productType,
    isValentineProduct,
    showInValentineShop,
    valentineCategories,
    valentineSections,
    availableDates,
    valentineBadge,
    featureInValentineHero,
    enableValentinePricing,
    dateWiseStock,
    dateWisePricing,
    dateWiseOffers,
    dateWiseDeliveryCharges,
    valentineDate,
    isValentineExclusive,
    valentineCategory,
    valentineSeoTitle,
    valentineSeoDescription,
    valentineSlug,
    seasonalCampaigns,
    campaignSettings,
    occasionIds,
    personalizationEnabled,
    personalizationType,
    fieldLabel,
    placeholder,
    minCharacters,
    maxCharacters,
    allowedCharacters,
    personalizationRequired,
    textTransform,
    helperText,
    pricePerCharacter,
    baseIncludedCharacters,
    maxExtraPrice,
  } = req.body;

  // Auto-map category strings to occasion IDs if they match
  let resolvedOccasionIds = Array.isArray(occasionIds) ? occasionIds : [];
  try {
    const Occasion = require('../models/Occasion');
    const dbOccasions = await Occasion.find({ status: 'active' });
    const finalOccasionIds = new Set(resolvedOccasionIds.map(id => id.toString()));

    const categoryTokens = new Set([
      (category || '').toLowerCase(),
      (subcategory || '').toLowerCase(),
      ...(Array.isArray(categories) ? categories : []).map(c => c.toLowerCase())
    ]);

    dbOccasions.forEach(occ => {
      const occSlug = occ.slug.toLowerCase();
      for (const token of categoryTokens) {
        if (token === occSlug || token.startsWith(occSlug + '-') || token.endsWith('-' + occSlug) || token.includes('-' + occSlug + '-')) {
          finalOccasionIds.add(occ._id.toString());
          break;
        }
      }
    });

    resolvedOccasionIds = Array.from(finalOccasionIds);
  } catch (occMatchErr) {
    console.error('Error auto-mapping occasions inside createProduct:', occMatchErr);
  }

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
    videos: videos || [],
    personalizationEnabled: personalizationEnabled || false,
    personalizationType: personalizationType || 'name',
    fieldLabel: fieldLabel || '',
    placeholder: placeholder || '',
    minCharacters: minCharacters !== undefined ? Number(minCharacters) : 1,
    maxCharacters: maxCharacters !== undefined ? Number(maxCharacters) : 10,
    allowedCharacters: allowedCharacters || {
      alphabets: true,
      numbers: false,
      spaces: true,
      hyphen: false,
      ampersand: false,
      period: false,
      emoji: false
    },
    personalizationRequired: personalizationRequired || false,
    textTransform: textTransform || 'original',
    helperText: helperText || '',
    pricePerCharacter: pricePerCharacter !== undefined ? Number(pricePerCharacter) : 0,
    baseIncludedCharacters: baseIncludedCharacters !== undefined ? Number(baseIncludedCharacters) : 0,
    maxExtraPrice: maxExtraPrice !== undefined ? Number(maxExtraPrice) : 0,
    details: details || [],
    careInstructions: careInstructions || [],
    isNew: typeof isNew === 'boolean' ? isNew : Boolean(isNewArrival),
    isFeatured: isFeatured || false,
    hidden: hidden || false,
    sameDay: sameDay !== undefined ? Boolean(sameDay) : true,
    isCustomizable: isCustomizable || false,
    customizationOptions: customizationOptions || {},
    hasPriceVariants: hasPriceVariants ?? false,
    priceVariants: priceVariants ?? [],
    comboItems: comboItems || [],
    comboName: comboName || '',
    comboDescription: comboDescription || '',
    comboSubcategory: comboSubcategory || '',
    subcategory: subcategory || '',
    productType: productType || 'regular',
    isValentineProduct: isValentineProduct || false,
    showInValentineShop: showInValentineShop || false,
    valentineCategories: valentineCategories || [],
    valentineSections: valentineSections || [],
    availableDates: availableDates || [],
    valentineBadge: valentineBadge || '',
    featureInValentineHero: featureInValentineHero || false,
    enableValentinePricing: enableValentinePricing || false,
    dateWiseStock: dateWiseStock || {},
    dateWisePricing: dateWisePricing || {},
    dateWiseOffers: dateWiseOffers || {},
    dateWiseDeliveryCharges: dateWiseDeliveryCharges || {},
    valentineDate: valentineDate || null,
    isValentineExclusive: isValentineExclusive || false,
    valentineCategory: valentineCategory || '',
    valentineSeoTitle: valentineSeoTitle || '',
    valentineSeoDescription: valentineSeoDescription || '',
    valentineSlug: valentineSlug || '',
    seasonalCampaigns: seasonalCampaigns || [],
    campaignSettings: campaignSettings || {},
    occasionIds: resolvedOccasionIds,
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
    subcategory,
    categories,
    countInStock,
    images,
    videos,
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
    sameDay,
    productType,
    isValentineProduct,
    showInValentineShop,
    valentineCategories,
    valentineSections,
    availableDates,
    valentineBadge,
    featureInValentineHero,
    enableValentinePricing,
    dateWiseStock,
    dateWisePricing,
    dateWiseOffers,
    dateWiseDeliveryCharges,
    valentineDate,
    isValentineExclusive,
    valentineCategory,
    valentineSeoTitle,
    valentineSeoDescription,
    valentineSlug,
    seasonalCampaigns,
    campaignSettings,
    occasionIds,
    personalizationEnabled,
    personalizationType,
    fieldLabel,
    placeholder,
    minCharacters,
    maxCharacters,
    allowedCharacters,
    personalizationRequired,
    textTransform,
    helperText,
    pricePerCharacter,
    baseIncludedCharacters,
    maxExtraPrice,
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

    // Auto-map category strings to occasion IDs if they match
    let resolvedOccasionIds = Array.isArray(occasionIds) ? occasionIds : (product.occasionIds || []);
    try {
      const Occasion = require('../models/Occasion');
      const dbOccasions = await Occasion.find({ status: 'active' });
      const finalOccasionIds = new Set(resolvedOccasionIds.map(id => id.toString()));

      const categoryTokens = new Set([
        (category || '').toLowerCase(),
        (subcategory || '').toLowerCase(),
        ...(Array.isArray(categories) ? categories : []).map(c => c.toLowerCase())
      ]);

      dbOccasions.forEach(occ => {
        const occSlug = occ.slug.toLowerCase();
        for (const token of categoryTokens) {
          if (token === occSlug || token.startsWith(occSlug + '-') || token.endsWith('-' + occSlug) || token.includes('-' + occSlug + '-')) {
            finalOccasionIds.add(occ._id.toString());
            break;
          }
        }
      });

      resolvedOccasionIds = Array.from(finalOccasionIds);
    } catch (occMatchErr) {
      console.error('Error auto-mapping occasions inside updateProduct:', occMatchErr);
    }

    const updateData = {
      title,
      description,
      price,
      discount: discount || 0,
      category,
      categories: categories || [],
      countInStock,
      images,
      videos: Array.isArray(videos) ? videos : [],
      personalizationEnabled: personalizationEnabled || false,
      personalizationType: personalizationType || 'name',
      fieldLabel: fieldLabel || '',
      placeholder: placeholder || '',
      minCharacters: minCharacters !== undefined ? Number(minCharacters) : 1,
      maxCharacters: maxCharacters !== undefined ? Number(maxCharacters) : 10,
      allowedCharacters: allowedCharacters || {
        alphabets: true,
        numbers: false,
        spaces: true,
        hyphen: false,
        ampersand: false,
        period: false,
        emoji: false
      },
      personalizationRequired: personalizationRequired || false,
      textTransform: textTransform || 'original',
      helperText: helperText || '',
      pricePerCharacter: pricePerCharacter !== undefined ? Number(pricePerCharacter) : 0,
      baseIncludedCharacters: baseIncludedCharacters !== undefined ? Number(baseIncludedCharacters) : 0,
      maxExtraPrice: maxExtraPrice !== undefined ? Number(maxExtraPrice) : 0,
      details: details || [],
      careInstructions: careInstructions || [],
      isNew: resolvedIsNew,
      isFeatured: Boolean(isFeatured),
      hidden: Boolean(hidden),
      sameDay: sameDay !== undefined ? Boolean(sameDay) : true,
      isCustomizable: Boolean(isCustomizable),
      customizationOptions: customizationOptions || {},
      hasPriceVariants: hasPriceVariants ?? false,
      priceVariants: Array.isArray(priceVariants) ? priceVariants : [],
      comboItems: comboItems || [],
      comboName: comboName || '',
      comboDescription: comboDescription || '',
      comboSubcategory: comboSubcategory || '',
      subcategory: subcategory || '',
      productType: productType || 'regular',
      isValentineProduct: isValentineProduct || false,
      showInValentineShop: showInValentineShop || false,
      valentineCategories: valentineCategories || [],
      valentineSections: valentineSections || [],
      availableDates: availableDates || [],
      valentineBadge: valentineBadge || '',
      featureInValentineHero: featureInValentineHero || false,
      enableValentinePricing: enableValentinePricing || false,
      dateWiseStock: dateWiseStock || {},
      dateWisePricing: dateWisePricing || {},
      dateWiseOffers: dateWiseOffers || {},
      dateWiseDeliveryCharges: dateWiseDeliveryCharges || {},
      valentineDate: valentineDate || null,
      isValentineExclusive: isValentineExclusive || false,
      valentineCategory: valentineCategory || '',
      valentineSeoTitle: valentineSeoTitle || '',
      valentineSeoDescription: valentineSeoDescription || '',
      valentineSlug: valentineSlug || '',
      seasonalCampaigns: seasonalCampaigns || [],
      campaignSettings: campaignSettings || {},
      occasionIds: resolvedOccasionIds,
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

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.user && req.user.role === 'vendor' && product.vendorId && product.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product removed successfully', success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
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
    const products = await Product.find({ hidden: false });
    const topProds = products.filter(p => p.isBestseller || (p.rating && p.rating >= 4));
    const sorted = await applySavedSortingToProducts(topProds.length > 0 ? topProds : products, 'bestsellers');
    const productsWithReviews = await addReviewStats(sorted);
    res.json(productsWithReviews);
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({ message: 'Error fetching top products' });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    let products = await Product.find({ hidden: false });
    const featProds = products.filter(p => p.isFeatured);
    const targetProducts = featProds.length > 0 ? featProds : products;
    
    // Apply saved sorting
    const sortedProducts = await applySavedSortingToProducts(targetProducts, 'featured');
    
    // Add real review statistics
    const productsWithReviews = await addReviewStats(sortedProducts);
    
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
    const products = await Product.find({ hidden: false });
    const newProds = products.filter(p => p.isNew || p.isNewArrival);
    const targetProducts = newProds.length > 0 ? newProds : products;

    // Apply saved sorting
    const sortedProducts = await applySavedSortingToProducts(targetProducts, 'newArrivals');
    
    // Add real review statistics
    const productsWithReviews = await addReviewStats(sortedProducts);
    
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
    const Category = require('../models/Category');
    const dbCategories = await Category.find({});
    const products = await Product.find({ hidden: false });

    // Build product category lookup map
    const countsMap = new Map();

    const addCount = (key) => {
      if (!key) return;
      const k = String(key).trim().toLowerCase();
      if (!k) return;
      countsMap.set(k, (countsMap.get(k) || 0) + 1);
      const unhyphenated = k.replace(/-/g, ' ');
      if (unhyphenated !== k) {
        countsMap.set(unhyphenated, (countsMap.get(unhyphenated) || 0) + 1);
      }
    };

    products.forEach(p => {
      const names = new Set();
      if (p.category) names.add(p.category);
      if (p.subcategory) names.add(p.subcategory);
      if (p.details && Array.isArray(p.details.categories)) {
        p.details.categories.forEach(c => names.add(c));
      }
      if (Array.isArray(p.categories)) {
        p.categories.forEach(c => {
          if (typeof c === 'string') names.add(c);
          else if (c && typeof c === 'object') {
            if (c.name) names.add(c.name);
            if (c.slug) names.add(c.slug);
            if (c.category && typeof c.category === 'object') {
              if (c.category.name) names.add(c.category.name);
              if (c.category.slug) names.add(c.category.slug);
            }
          }
        });
      }
      if (Array.isArray(p.occasions)) {
        p.occasions.forEach(o => {
          if (typeof o === 'string') names.add(o);
          else if (o && typeof o === 'object') {
            if (o.name) names.add(o.name);
            if (o.slug) names.add(o.slug);
            if (o.occasion && typeof o.occasion === 'object') {
              if (o.occasion.name) names.add(o.occasion.name);
              if (o.occasion.slug) names.add(o.occasion.slug);
            }
          }
        });
      }
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          if (typeof t === 'string') names.add(t);
          else if (t && typeof t === 'object' && t.tag) names.add(t.tag);
        });
      }
      names.forEach(n => addCount(n));
    });

    const result = [];
    const addedNames = new Set();

    // Include DB categories first with computed counts
    dbCategories.forEach(cat => {
      const nameKey = (cat.name || '').trim().toLowerCase();
      const slugKey = (cat.slug || '').trim().toLowerCase();

      const countByName = countsMap.get(nameKey) || 0;
      const countBySlug = countsMap.get(slugKey) || 0;
      const maxCount = Math.max(countByName, countBySlug);

      result.push({
        _id: cat._id || cat.id,
        id: cat._id || cat.id,
        name: cat.name,
        slug: cat.slug,
        count: maxCount,
        productCount: maxCount
      });

      addedNames.add(nameKey);
      addedNames.add(slugKey);
    });

    // Also include remaining dynamic category counts from products
    countsMap.forEach((count, key) => {
      if (!addedNames.has(key)) {
        const formattedName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        result.push({
          _id: key,
          id: key,
          name: formattedName,
          slug: key.replace(/\s+/g, '-'),
          count: count,
          productCount: count
        });
        addedNames.add(key);
      }
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching categories with counts:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @route   GET /api/products/category/:category
// @desc    Get products by category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const rawCategory = req.params.category ? req.params.category.trim() : '';
    console.log(`🔍 Fetching products for category: "${rawCategory}"`);

    const allProducts = await Product.find({});
    const target = rawCategory.toLowerCase().replace(/-/g, ' ').replace(/s$/, '');

    const matchingProducts = allProducts.filter(p => {
      if (p.hidden) return false;
      const pCat = (p.category || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, '');
      const pSubCat = (p.subcategory || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, '');
      const pCats = Array.isArray(p.categories)
        ? p.categories.map(c => c.toLowerCase().replace(/-/g, ' ').replace(/s$/, ''))
        : [];

      return (
        (pCat && (pCat.includes(target) || target.includes(pCat))) ||
        (pSubCat && (pSubCat.includes(target) || target.includes(pSubCat))) ||
        pCats.some(c => c && (c.includes(target) || target.includes(c)))
      );
    });

    res.json(matchingProducts);
  } catch (error) {
    console.error(`Error fetching products for category ${req.params.category}:`, error);
    res.status(500).json({ message: 'Server Error', error: error.message });
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
// @desc Get all pending approval products (vendor products requiring admin approval)
// @route GET /api/products/admin/pending-approval
// @access Private/Admin
const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({
      approvalStatus: 'pending',
      vendor: { $ne: null }
    })
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

// @desc    Bulk update Valentine settings for products
// @route   POST /api/products/admin/bulk-valentine
// @access  Private/Admin
const bulkUpdateValentineSettings = asyncHandler(async (req, res) => {
  const { productIds, action, value } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'No product IDs provided' });
  }

  let updateQuery = {};
  switch (action) {
    case 'addToShop':
      updateQuery = { 
        showInValentineShop: true, 
        isValentineProduct: true, 
        productType: 'valentine' 
      };
      break;
    case 'removeFromShop':
      updateQuery = { showInValentineShop: false };
      break;
    case 'assignCategories':
      if (!Array.isArray(value)) {
        return res.status(400).json({ message: 'Categories list must be an array' });
      }
      updateQuery = { valentineCategories: value };
      break;
    case 'assignDates':
      if (!Array.isArray(value)) {
        return res.status(400).json({ message: 'Dates list must be an array' });
      }
      updateQuery = { availableDates: value };
      break;
    case 'enableOffers':
      updateQuery = { enableValentinePricing: true };
      break;
    case 'disableProducts':
      updateQuery = { 
        isValentineProduct: false, 
        productType: 'regular',
        showInValentineShop: false 
      };
      break;
    default:
      return res.status(400).json({ message: 'Invalid bulk action' });
  }

  await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: updateQuery }
  );

  res.json({ success: true, message: 'Products updated successfully' });
});

// --- DISPLAY ORDER MANAGEMENT FUNCTIONS ---

// Helper to query products for a given section
const getProductsForSectionQuery = (section) => {
  let query = {};
  
  if (section === 'featured') {
    query.isFeatured = true;
  } else if (section === 'shop') {
    query.$or = [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } }
    ];
  } else if (section === 'newArrivals' || section === 'new') {
    query.$or = [
      { isNew: true },
      { isNewArrival: true }
    ];
  } else if (section === 'recommended') {
    query.isRecommended = true;
  } else if (section === 'valentine') {
    query.$or = [
      { isValentineProduct: true },
      { productType: 'valentine' }
    ];
  } else if (section === 'mothersDay' || section === 'mothers-day') {
    query.$or = [
      { category: { $regex: /^mothers-day$/i } },
      { category: { $regex: /^mother's day$/i } },
      { categories: { $elemMatch: { $regex: /^mothers-day$/i } } },
      { categories: { $elemMatch: { $regex: /^mother's day$/i } } }
    ];
  } else if (section === 'fathersDay' || section === 'fathers-day') {
    query.$or = [
      { category: { $regex: /^fathers-day$/i } },
      { category: { $regex: /^father's day$/i } },
      { categories: { $elemMatch: { $regex: /^fathers-day$/i } } },
      { categories: { $elemMatch: { $regex: /^father's day$/i } } }
    ];
  } else if (section === 'friendshipDay' || section === 'friendship-day') {
    query.$or = [
      { category: { $regex: /^friendship-day$/i } },
      { category: { $regex: /^friendship day$/i } },
      { categories: { $elemMatch: { $regex: /^friendship-day$/i } } },
      { categories: { $elemMatch: { $regex: /^friendship day$/i } } }
    ];
  } else if (section === 'rakhi' || section === 'raksha-bandhan') {
    query.$or = [
      { category: { $regex: /^rakhi$/i } },
      { category: { $regex: /^raksha-bandhan$/i } },
      { category: { $regex: /^raksha bandhan$/i } },
      { categories: { $elemMatch: { $regex: /^rakhi$/i } } },
      { categories: { $elemMatch: { $regex: /^raksha-bandhan$/i } } },
      { categories: { $elemMatch: { $regex: /^raksha bandhan$/i } } }
    ];
  } else if (section === 'diwali') {
    query.$or = [
      { category: { $regex: /^diwali$/i } },
      { categories: { $elemMatch: { $regex: /^diwali$/i } } }
    ];
  } else if (section === 'newYear' || section === 'new-year') {
    query.$or = [
      { category: { $regex: /^new-year$/i } },
      { category: { $regex: /^new year$/i } },
      { categories: { $elemMatch: { $regex: /^new-year$/i } } },
      { categories: { $elemMatch: { $regex: /^new year$/i } } }
    ];
  } else if (section.startsWith('category:')) {
    const categoryName = section.substring(9).trim();
    query.$or = [
      { category: { $regex: new RegExp(`^${categoryName}$`, 'i') } },
      { subcategory: { $regex: new RegExp(`^${categoryName}$`, 'i') } },
      { categories: { $elemMatch: { $regex: new RegExp(`^${categoryName}$`, 'i') } } }
    ];
  }
  
  return query;
};

// Helper to fetch products for a specific occasion by slug or name
const getProductsForOccasion = async (slug) => {
  const Occasion = require('../models/Occasion');
  const Category = require('../models/Category');

  const cleanSlug = (slug || '').toLowerCase().trim();
  let occasionDoc = await Occasion.findOne({ slug: cleanSlug });
  let occasionData = occasionDoc ? (typeof occasionDoc.toObject === 'function' ? occasionDoc.toObject() : occasionDoc) : null;

  if (!occasionData) {
    const cat = await Category.findOne({ slug: cleanSlug });
    if (cat) {
      occasionData = typeof cat.toObject === 'function' ? cat.toObject() : cat;
    }
  }

  const allProducts = await Product.find({});
  const target = cleanSlug.replace(/-/g, ' ').replace(/s$/, '');

  let linkedProductIds = new Set();
  if (occasionData && (occasionData.id || occasionData._id)) {
    try {
      const poLinks = await prisma.productOccasion.findMany({
        where: { occasionId: String(occasionData.id || occasionData._id) },
        select: { productId: true }
      });
      poLinks.forEach(l => linkedProductIds.add(l.productId));
    } catch (e) {}
  }

  return allProducts.filter(p => {
    const pid = String(p._id || p.id);
    if (linkedProductIds.has(pid)) return true;

    const pTitle = (p.title || p.name || '').toLowerCase();
    const pCat = (p.category || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, '');
    const pSubCat = (p.subcategory || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, '');
    const pCats = Array.isArray(p.categories)
      ? p.categories.map(c => (typeof c === 'string' ? c : c.name || c.slug || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, ''))
      : [];
    const pTags = Array.isArray(p.tags)
      ? p.tags.map(t => (typeof t === 'string' ? t : t.tag || '').toLowerCase().replace(/-/g, ' '))
      : [];
    const pOccasions = Array.isArray(p.occasions)
      ? p.occasions.map(o => (typeof o === 'string' ? o : o.name || o.slug || '').toLowerCase().replace(/-/g, ' ').replace(/s$/, ''))
      : [];

    return (
      (pCat && (pCat.includes(target) || target.includes(pCat))) ||
      (pSubCat && (pSubCat.includes(target) || target.includes(pSubCat))) ||
      pCats.some(c => c && (c.includes(target) || target.includes(c))) ||
      pTags.some(t => t && (t.includes(target) || target.includes(t))) ||
      pOccasions.some(o => o && (o.includes(target) || target.includes(o))) ||
      pTitle.includes(target)
    );
  });
};

// Helper to get display order sequence number of a product for a given section
const getDisplayOrderValue = (product, section) => {
  if (!product || !product.displayOrders) return 0;
  const dobj = product.displayOrders;
  const secKey = (section || '').replace(/^(category:|occasion:)/, '').trim().toLowerCase();

  if (section === 'featured') return dobj.featured || 0;
  if (section === 'shop') return dobj.shop || 0;
  if (section === 'newArrivals' || section === 'new') return dobj.newArrivals || 0;
  if (section === 'recommended') return dobj.recommended || 0;
  
  if (dobj.occasions && typeof dobj.occasions === 'object') {
    if (dobj.occasions[secKey] !== undefined) return Number(dobj.occasions[secKey]) || 0;
    const camel = secKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (dobj.occasions[camel] !== undefined) return Number(dobj.occasions[camel]) || 0;
    const kebab = secKey.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    if (dobj.occasions[kebab] !== undefined) return Number(dobj.occasions[kebab]) || 0;
  }

  if (dobj.categories) {
    if (dobj.categories instanceof Map) {
      if (dobj.categories.has(secKey)) return Number(dobj.categories.get(secKey)) || 0;
    } else if (typeof dobj.categories === 'object') {
      if (dobj.categories[secKey] !== undefined) return Number(dobj.categories[secKey]) || 0;
    }
  }
  
  return Number(dobj[secKey]) || 0;
};

// Main sorting function combining Custom order, Selected Sort preference and Created Date
const sortProductsWithPreference = (products, section, sortBy, sortDirection) => {
  const isAsc = sortDirection === 'asc';
  
  return products.sort((a, b) => {
    // 1. Custom Display Order (if defined/greater than 0)
    const orderA = getDisplayOrderValue(a, section);
    const orderB = getDisplayOrderValue(b, section);
    
    const hasOrderA = orderA > 0;
    const hasOrderB = orderB > 0;
    
    if (hasOrderA && hasOrderB) {
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    } else if (hasOrderA) {
      return -1;
    } else if (hasOrderB) {
      return 1;
    }
    
    // 2. Selected Sort Rule
    let valA, valB;
    switch (sortBy) {
      case 'name':
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
        break;
      case 'price':
        valA = a.price || 0;
        valB = b.price || 0;
        break;
      case 'createdAt':
      case 'date':
        valA = new Date(a.createdAt || 0).getTime();
        valB = new Date(b.createdAt || 0).getTime();
        break;
      case 'updatedAt':
        valA = new Date(a.updatedAt || 0).getTime();
        valB = new Date(b.updatedAt || 0).getTime();
        break;
      case 'stock':
        valA = a.countInStock || 0;
        valB = b.countInStock || 0;
        break;
      case 'bestSelling':
        valA = a.numReviews || 0;
        valB = b.numReviews || 0;
        break;
      case 'mostViewed':
        valA = a.rating || 0;
        valB = b.rating || 0;
        break;
      default:
        valA = new Date(a.createdAt || 0).getTime();
        valB = new Date(b.createdAt || 0).getTime();
        return valB - valA; // Default to newest first
    }
    
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    
    // 3. Fallback to Default Created Date (newest first)
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

// Helper wrapper to fetch preference and sort a product list
const applySavedSortingToProducts = async (products, section) => {
  const preference = await SectionSortingPreference.findOne({ section }) || {
    sortBy: 'custom',
    sortDirection: 'asc'
  };
  return sortProductsWithPreference(products, section, preference.sortBy, preference.sortDirection);
};

// @desc Fetch products for a specific section, ordered by display order + preferences
// @route GET /api/products/order/:section
// @access Private/Admin
const getSectionProductsForSorting = asyncHandler(async (req, res) => {
  const { section } = req.params;
  
  if (!section) {
    return res.status(400).json({ message: 'Section is required' });
  }
  
  let products = [];
  if (section.startsWith('occasion:')) {
    const slug = section.substring(9).trim().toLowerCase();
    products = await getProductsForOccasion(slug);
  } else {
    const query = getProductsForSectionQuery(section);
    products = await Product.find(query);
  }
  
  const preference = await SectionSortingPreference.findOne({ section }) || {
    sortBy: 'custom',
    sortDirection: 'asc'
  };
  
  const sortedProducts = sortProductsWithPreference(
    products, 
    section, 
    preference.sortBy, 
    preference.sortDirection
  );
  
  res.json({
    section,
    sortBy: preference.sortBy,
    sortDirection: preference.sortDirection,
    products: sortedProducts
  });
});

// @desc Update product sequence numbers and sorting preferences
// @route PUT /api/products/order/update
// @access Private/Admin
// Helper to cleanly apply section display order to a product's displayOrders object
const setProductSectionOrder = (displayOrders, section, numOrder) => {
  const dobj = displayOrders && typeof displayOrders === 'object' && !Array.isArray(displayOrders) ? { ...displayOrders } : {};
  const orderVal = Number(numOrder);

  if (section === 'featured') {
    dobj.featured = orderVal;
  } else if (section === 'shop' || section === 'none') {
    dobj.shop = orderVal;
  } else if (section === 'newArrivals' || section === 'new') {
    dobj.newArrivals = orderVal;
  } else if (section === 'recommended') {
    dobj.recommended = orderVal;
  } else if (section.startsWith('category:')) {
    const categoryName = section.substring(9).trim().toLowerCase();
    if (!dobj.categories || typeof dobj.categories !== 'object' || Array.isArray(dobj.categories)) {
      dobj.categories = {};
    }
    dobj.categories[categoryName] = orderVal;
  } else {
    // Occasion or custom section
    const occSlug = section.startsWith('occasion:')
      ? section.substring(9).trim().toLowerCase()
      : section.trim().toLowerCase();
    if (!dobj.occasions || typeof dobj.occasions !== 'object' || Array.isArray(dobj.occasions)) {
      dobj.occasions = {};
    }
    dobj.occasions[occSlug] = orderVal;

    const camel = occSlug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    dobj.occasions[camel] = orderVal;
  }

  return dobj;
};

// @desc Update single or multiple section product orders
// @route PUT /api/products/order/update
// @access Private/Admin
const updateSectionProductsOrder = asyncHandler(async (req, res) => {
  const { section, displayOrders, sortBy, sortDirection, auditMetadata } = req.body;
  
  if (!section) {
    return res.status(400).json({ message: 'Section is required' });
  }
  
  if (sortBy) {
    await SectionSortingPreference.findOneAndUpdate(
      { section },
      { sortBy, sortDirection: sortDirection || 'asc' },
      { upsert: true, new: true }
    );
  }
  
  if (displayOrders && typeof displayOrders === 'object') {
    const entries = Object.entries(displayOrders);
    if (entries.length > 0) {
      const productIds = entries.map(([id]) => id);
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, displayOrders: true }
      });
      const productMap = new Map(existingProducts.map(p => [p.id, p]));

      const chunk = 50;
      for (let i = 0; i < entries.length; i += chunk) {
        const batch = entries.slice(i, i + chunk);
        const operations = batch.map(([productId, orderNumber]) => {
          const currentProduct = productMap.get(productId);
          const currentOrders = currentProduct ? currentProduct.displayOrders : {};
          const updatedOrders = setProductSectionOrder(currentOrders, section, orderNumber);
          return prisma.product.update({
            where: { id: productId },
            data: { displayOrders: updatedOrders }
          });
        });
        await prisma.$transaction(operations);
      }

      try {
        const { clearSearchCache } = require('./searchController');
        clearSearchCache();
      } catch (e) {}

      // Record reorder audit log
      try {
        await ActivityLog.create({
          userId: req.user?.id || req.user?._id || 'admin',
          userName: req.user?.name || auditMetadata?.adminName || 'Admin',
          email: req.user?.email || null,
          action: 'bulk_reorder',
          actionType: 'bulk_reorder',
          module: 'product_order_arrangement',
          details: {
            section,
            previousPositions: auditMetadata?.previousPositions || {},
            newPositions: displayOrders,
            affectedCount: auditMetadata?.affectedCount || entries.length,
            description: auditMetadata?.actionDescription || `Updated order for ${entries.length} products in section: ${section}`,
            productIds,
            timestamp: new Date()
          }
        });
      } catch (logErr) {
        console.error('⚠️ Failed to save ordering audit log:', logErr.message);
      }
    }
  }
  
  res.json({ success: true, message: 'Display order updated successfully' });
});

// @desc Enterprise Bulk Reorder with atomic transactions, sequence validation and audit logging
// @route PUT /api/products/order/bulk-reorder
// @access Private/Admin
const bulkReorderProducts = asyncHandler(async (req, res) => {
  const { section, displayOrders, sortBy, sortDirection, auditMetadata } = req.body;

  if (!section) {
    return res.status(400).json({ message: 'Section is required' });
  }

  if (!displayOrders || typeof displayOrders !== 'object') {
    return res.status(400).json({ message: 'displayOrders mapping is required' });
  }

  if (sortBy) {
    await SectionSortingPreference.findOneAndUpdate(
      { section },
      { sortBy, sortDirection: sortDirection || 'asc' },
      { upsert: true, new: true }
    );
  }

  const entries = Object.entries(displayOrders);
  if (entries.length === 0) {
    return res.json({ success: true, message: 'No order updates provided' });
  }

  const productIds = entries.map(([id]) => id);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, displayOrders: true }
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  // Batch updates in chunks of 50 via prisma transactions
  const chunk = 50;
  for (let i = 0; i < entries.length; i += chunk) {
    const batch = entries.slice(i, i + chunk);
    const operations = batch.map(([productId, orderNum]) => {
      const existing = productMap.get(productId);
      const currentOrders = existing ? existing.displayOrders : {};
      const newDisplayOrders = setProductSectionOrder(currentOrders, section, Number(orderNum));
      return prisma.product.update({
        where: { id: productId },
        data: { displayOrders: newDisplayOrders }
      });
    });
    await prisma.$transaction(operations);
  }

  try {
    const { clearSearchCache } = require('./searchController');
    clearSearchCache();
  } catch (e) {}

  let auditLog = null;
  try {
    auditLog = await ActivityLog.create({
      userId: req.user?.id || req.user?._id || 'admin',
      userName: req.user?.name || auditMetadata?.adminName || 'Admin',
      email: req.user?.email || null,
      action: 'bulk_reorder',
      actionType: 'bulk_reorder',
      module: 'product_order_arrangement',
      details: {
        section,
        previousPositions: auditMetadata?.previousPositions || {},
        newPositions: displayOrders,
        affectedCount: auditMetadata?.affectedCount || entries.length,
        description: auditMetadata?.actionDescription || `Bulk reordered ${entries.length} products in section: ${section}`,
        productIds,
        timestamp: new Date()
      }
    });
  } catch (logErr) {
    console.error('⚠️ Failed to save ordering audit log:', logErr.message);
  }

  return res.json({
    success: true,
    message: `Display order successfully updated for ${entries.length} products in section: ${section}`,
    auditLogId: auditLog?.id || null,
    updatedCount: entries.length
  });
});

// @desc Get audit logs for product reordering history
// @route GET /api/products/order/audit-logs
// @access Private/Admin
const getOrderAuditLogs = asyncHandler(async (req, res) => {
  const { section, limit = 25 } = req.query;

  const logs = await ActivityLog.find({
    module: 'product_order_arrangement',
    action: { $in: ['bulk_reorder', 'rollback_reorder'] }
  });

  let formatted = logs.map(l => {
    const details = l.details || {};
    return {
      id: l.id || l._id,
      _id: l.id || l._id,
      adminName: l.userName || 'Admin',
      email: l.email || null,
      action: l.action,
      timestamp: l.createdAt || l.timestamp,
      section: details.section || 'global',
      description: details.description || 'Reorder operation',
      affectedCount: details.affectedCount || 0,
      previousPositions: details.previousPositions || {},
      newPositions: details.newPositions || {},
      productIds: details.productIds || []
    };
  });

  if (section && section !== 'all') {
    formatted = formatted.filter(l => l.section === section);
  }

  formatted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json({
    success: true,
    logs: formatted.slice(0, parseInt(limit, 10))
  });
});

// @desc Rollback product order changes to a previous audit checkpoint
// @route POST /api/products/order/rollback
// @access Private/Admin
const rollbackOrderChanges = asyncHandler(async (req, res) => {
  const { auditLogId } = req.body;

  if (!auditLogId) {
    return res.status(400).json({ message: 'auditLogId is required for rollback' });
  }

  const log = await prisma.activityLog.findFirst({
    where: { id: String(auditLogId) }
  });

  if (!log || !log.details) {
    return res.status(404).json({ message: 'Audit log record not found' });
  }

  const details = typeof log.details === 'object' ? log.details : JSON.parse(log.details);
  const { section, previousPositions } = details;

  if (!section || !previousPositions || Object.keys(previousPositions).length === 0) {
    return res.status(400).json({ message: 'Audit log does not contain restorable previous positions' });
  }

  const entries = Object.entries(previousPositions);
  const productIds = entries.map(([id]) => id);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, displayOrders: true }
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const chunk = 50;
  for (let i = 0; i < entries.length; i += chunk) {
    const batch = entries.slice(i, i + chunk);
    const operations = batch.map(([productId, orderNum]) => {
      const existing = productMap.get(productId);
      const currentOrders = existing ? existing.displayOrders : {};
      const newDisplayOrders = setProductSectionOrder(currentOrders, section, Number(orderNum));
      return prisma.product.update({
        where: { id: productId },
        data: { displayOrders: newDisplayOrders }
      });
    });
    await prisma.$transaction(operations);
  }

  try {
    const { clearSearchCache } = require('./searchController');
    clearSearchCache();
  } catch (e) {}

  await ActivityLog.create({
    userId: req.user?.id || req.user?._id || 'admin',
    userName: req.user?.name || 'Admin',
    email: req.user?.email || null,
    action: 'rollback_reorder',
    actionType: 'rollback_reorder',
    module: 'product_order_arrangement',
    details: {
      section,
      rolledBackAuditLogId: auditLogId,
      restoredCount: entries.length,
      description: `Rolled back order changes for ${entries.length} products to checkpoint from ${log.createdAt || log.timestamp}`,
      timestamp: new Date()
    }
  });

  return res.json({
    success: true,
    message: `Successfully rolled back ${entries.length} products in section: ${section}`,
    restoredCount: entries.length
  });
});

// @desc Perform bulk operations (Move/Remove Featured, Change Category/Visibility, Update Display Order)
// @route PUT /api/products/order/bulk-update
// @access Private/Admin
const bulkUpdateSectionProducts = asyncHandler(async (req, res) => {
  const { productIds, action, value, section } = req.body;
  
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'No product IDs provided' });
  }
  
  if (action === 'moveToFeatured') {
    const featuredProducts = await Product.find({ isFeatured: true });
    let maxOrder = 0;
    featuredProducts.forEach(p => {
      const order = p.displayOrders?.featured || 0;
      if (order > maxOrder) maxOrder = order;
    });
    
    for (let i = 0; i < productIds.length; i++) {
      const product = await Product.findById(productIds[i]);
      if (product) {
        product.isFeatured = true;
        if (!product.displayOrders) product.displayOrders = {};
        product.displayOrders.featured = maxOrder + i + 1;
        await product.save();
      }
    }
  } else if (action === 'removeFromFeatured') {
    for (const id of productIds) {
      const product = await Product.findById(id);
      if (product) {
        product.isFeatured = false;
        if (product.displayOrders) product.displayOrders.featured = 0;
        await product.save();
      }
    }
  } else if (action === 'changeCategory') {
    if (!value) {
      return res.status(400).json({ message: 'New category is required' });
    }
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { category: value } }
    );
  } else if (action === 'assignOccasions') {
    if (!Array.isArray(value)) {
      return res.status(400).json({ message: 'Occasions list must be an array' });
    }
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { occasionIds: value } }
    );
  } else if (action === 'changeVisibility') {
    const hidden = value === false;
    await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: { hidden: hidden } }
    );
  } else if (action === 'updateDisplayOrder') {
    if (value && typeof value === 'object') {
      const activeSection = section || 'shop';
      for (const [productId, orderNumber] of Object.entries(value)) {
        const product = await Product.findById(productId);
        if (product) {
          if (!product.displayOrders) product.displayOrders = {};
          const numOrder = Number(orderNumber);
          
          if (activeSection === 'featured') product.displayOrders.featured = numOrder;
          else if (activeSection === 'shop') product.displayOrders.shop = numOrder;
          else if (activeSection === 'newArrivals' || activeSection === 'new') product.displayOrders.newArrivals = numOrder;
          else if (activeSection === 'recommended') product.displayOrders.recommended = numOrder;
          else if (activeSection === 'valentine' || activeSection === 'valentines-day') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.valentine = numOrder;
          } else if (activeSection === 'mothersDay' || activeSection === 'mothers-day') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.mothersDay = numOrder;
          } else if (activeSection === 'fathersDay' || activeSection === 'fathers-day') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.fathersDay = numOrder;
          } else if (activeSection === 'friendshipDay' || activeSection === 'friendship-day') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.friendshipDay = numOrder;
          } else if (activeSection === 'rakhi' || activeSection === 'raksha-bandhan') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.rakhi = numOrder;
          } else if (activeSection === 'diwali') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.diwali = numOrder;
          } else if (activeSection === 'newYear' || activeSection === 'new-year') {
            if (!product.displayOrders.occasions) product.displayOrders.occasions = {};
            product.displayOrders.occasions.newYear = numOrder;
          } else if (activeSection.startsWith('category:')) {
            const categoryName = activeSection.substring(9).trim();
            if (!product.displayOrders.categories) {
              product.displayOrders.categories = new Map();
            }
            product.displayOrders.categories.set(categoryName, numOrder);
          }
          await product.save();
        }
      }
    }
  } else {
    return res.status(400).json({ message: 'Invalid bulk action' });
  }
  
  res.json({ success: true, message: 'Bulk update completed successfully' });
});

// @desc Reset display order sequence numbers back to 0
// @route POST /api/products/order/reset
// @access Private/Admin
const resetSectionProductsOrder = asyncHandler(async (req, res) => {
  const { section } = req.body;
  
  if (!section) {
    return res.status(400).json({ message: 'Section is required' });
  }
  
  const query = getProductsForSectionQuery(section);
  const products = await Product.find(query);
  
  for (const product of products) {
    if (product.displayOrders) {
      if (section === 'featured') product.displayOrders.featured = 0;
      else if (section === 'shop') product.displayOrders.shop = 0;
      else if (section === 'newArrivals' || section === 'new') product.displayOrders.newArrivals = 0;
      else if (section === 'recommended') product.displayOrders.recommended = 0;
      else if (section === 'valentine' || section === 'valentines-day') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.valentine = 0;
      } else if (section === 'mothersDay' || section === 'mothers-day') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.mothersDay = 0;
      } else if (section === 'fathersDay' || section === 'fathers-day') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.fathersDay = 0;
      } else if (section === 'friendshipDay' || section === 'friendship-day') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.friendshipDay = 0;
      } else if (section === 'rakhi' || section === 'raksha-bandhan') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.rakhi = 0;
      } else if (section === 'diwali') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.diwali = 0;
      } else if (section === 'newYear' || section === 'new-year') {
        if (product.displayOrders.occasions) product.displayOrders.occasions.newYear = 0;
      } else if (section.startsWith('category:')) {
        const categoryName = section.substring(9).trim();
        if (product.displayOrders.categories) {
          product.displayOrders.categories.delete(categoryName);
        }
      }
      await product.save();
    }
  }
  
  res.json({ success: true, message: 'Display order reset successfully' });
});

// @desc Get share preview HTML with dynamic meta tags for social crawlers
// @route GET /api/products/share-preview/:type/:idOrSlug
// @access Public
const getSharePreview = async (req, res) => {
  try {
    const { type, idOrSlug } = req.params;
    const path = require('path');
    const fs = require('fs');

    let product = null;

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug);
    } else {
      const terms = idOrSlug.split('-');
      const firstTerm = terms[0];
      
      if (firstTerm) {
        // Find products matching the first term in their title to narrow down
        const candidates = await Product.find({
          $or: [
            { title: { $regex: new RegExp(firstTerm, 'i') } },
            { valentineSlug: idOrSlug }
          ]
        });

        // Helper function to slugify title
        const slugify = (text) => {
          return text
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars (except -)
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start
            .replace(/-+$/, '');            // Trim - from end
        };

        product = candidates.find(c => 
          slugify(c.title) === idOrSlug || c.valentineSlug === idOrSlug
        );
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://sbflorist.in';
    const protocol = req.protocol;
    const host = req.get('host');
    const backendUrl = `${protocol}://${host}`;

    // Read the index.html template
    const pathsToTry = [
      path.join(__dirname, '..', 'dist', 'index.html'),
      path.join(__dirname, '..', '..', 'sbf-main', 'dist', 'index.html'),
      path.join(__dirname, '..', '..', 'sbf-main', 'index.html'),
    ];

    let htmlTemplate = '';
    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        try {
          htmlTemplate = fs.readFileSync(p, 'utf8');
          break;
        } catch (err) {
          console.error(`Error reading index.html at ${p}:`, err);
        }
      }
    }

    if (!htmlTemplate) {
      // Try fetching from frontend URL
      try {
        const axios = require('axios');
        const response = await axios.get(`${frontendUrl}/index.html`, { timeout: 3000 });
        htmlTemplate = response.data;
      } catch (err) {
        console.error(`Error fetching index.html from frontend URL:`, err.message);
        // Minimal fallback template
        htmlTemplate = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Spring Blossoms Florist</title></head><body><div id="root"></div></body></html>`;
      }
    }

    let metaData = {
      title: 'Spring Blossoms Florist - Fresh Flower Delivery',
      description: 'Premium flower delivery in Hyderabad. Online bouquet shop offering roses, lilies, and custom arrangements with same day and midnight delivery options.',
      image: 'https://res.cloudinary.com/djtrhfqan/image/upload/v1769532776/sbflorist/assets/logosbf.jpg',
      url: `${frontendUrl}`,
      price: '0'
    };

    if (product) {
      // Determine actual price including discount
      let finalPrice = product.price;
      if (product.discount > 0) {
        finalPrice = Math.round(product.price * (1 - product.discount / 100));
      }

      // Title includes product name and price
      metaData.title = `${product.title} - ₹${finalPrice} | Spring Blossoms Florist`;

      // Clean and format description (strip HTML, truncate to 155 chars)
      let rawDescription = product.description || '';
      let cleanedDesc = rawDescription.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedDesc.length > 155) {
        cleanedDesc = cleanedDesc.substring(0, 152) + '...';
      }
      metaData.description = cleanedDesc || `Buy ${product.title} from Spring Blossoms Florist.`;

      // Price
      metaData.price = finalPrice.toString();

      // Canonical URL
      metaData.url = `${frontendUrl}/${type || 'product'}/${idOrSlug}`;

      // Featured image URL (HTTPS, absolute)
      let mainImage = '';
      if (product.images && product.images.length > 0) {
        mainImage = product.images[0];
      }

      if (mainImage) {
        if (mainImage.startsWith('http://') || mainImage.startsWith('https://')) {
          metaData.image = mainImage;
        } else if (mainImage.startsWith('/uploads/')) {
          metaData.image = `${backendUrl}${mainImage}`;
        } else if (mainImage.startsWith('/images/')) {
          metaData.image = `${frontendUrl}${mainImage}`;
        } else {
          metaData.image = `${backendUrl}/uploads/${mainImage}`;
        }
      }

      // Optimize image URL for Cloudinary/Unsplash dimensions
      if (metaData.image.includes('res.cloudinary.com') && metaData.image.includes('/upload/')) {
        metaData.image = metaData.image.replace('/upload/', '/upload/w_1200,h_630,c_fill/');
      } else if (metaData.image.includes('images.unsplash.com')) {
        try {
          const parsed = new URL(metaData.image);
          parsed.searchParams.set('w', '1200');
          parsed.searchParams.set('h', '630');
          parsed.searchParams.set('fit', 'crop');
          parsed.searchParams.set('q', '80');
          metaData.image = parsed.toString();
        } catch (e) {
          // ignore
        }
      }
    }

    // Perform meta tag replacement in HTML template
    let cleanedHtml = htmlTemplate;
    
    // Remove existing meta/title/canonical tags
    cleanedHtml = cleanedHtml.replace(/<title>[^]*?<\/title>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<meta\s+name=["']description["']\s+content=["'][^]*?["']\s*\/?>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<link\s+rel=["']canonical["']\s+href=["'][^]*?["']\s*\/?>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<meta\s+(property|name)=["']og:[^]*?["']\s+content=["'][^]*?["']\s*\/?>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<meta\s+(property|name)=["']twitter:[^]*?["']\s+content=["'][^]*?["']\s*\/?>/gi, '');

    const newTags = `
  <title>${metaData.title}</title>
  <meta name="description" content="${metaData.description}" />
  <link rel="canonical" href="${metaData.url}" />
  
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${metaData.title}" />
  <meta property="og:description" content="${metaData.description}" />
  <meta property="og:image" content="${metaData.image}" />
  <meta property="og:image:secure_url" content="${metaData.image}" />
  <meta property="og:url" content="${metaData.url}" />
  <meta property="og:site_name" content="Spring Blossoms Florist" />
  <meta property="product:price:amount" content="${metaData.price}" />
  <meta property="product:price:currency" content="INR" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${metaData.title}" />
  <meta name="twitter:description" content="${metaData.description}" />
  <meta name="twitter:image" content="${metaData.image}" />`;

    cleanedHtml = cleanedHtml.replace(/<head>/i, `<head>${newTags}`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(cleanedHtml);
  } catch (error) {
    console.error('Error generating share preview HTML:', error);
    return res.status(500).send('Internal Server Error');
  }
};

const getVideoSitemap = async (req, res) => {
  try {
    const products = await Product.find({
      hidden: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } }
      ],
      videos: { $exists: true, $not: { $size: 0 } }
    });

    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;

    for (const product of products) {
      const loc = `${baseUrl}/product/${product._id}`;
      for (const video of product.videos) {
        const thumbnail = video.thumbnailUrl || (product.images && product.images[0]) || `${baseUrl}/images/placeholder.svg`;
        const title = video.title || product.title;
        const description = video.description || product.description || 'Watch our premium product arrangement in motion.';
        const contentLoc = video.url;

        const escapeXml = (unsafe) => {
          if (!unsafe) return '';
          return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
              case '<': return '&lt;';
              case '>': return '&gt;';
              case '&': return '&amp;';
              case '\'': return '&apos;';
              case '"': return '&quot;';
              default: return c;
            }
          });
        };

        xml += `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(title)}</video:title>
      <video:description>${escapeXml(description.substring(0, 2048))}</video:description>
      <video:content_loc>${escapeXml(contentLoc)}</video:content_loc>
      <video:player_loc>${escapeXml(loc)}</video:player_loc>
      <video:duration>${video.duration || 30}</video:duration>
    </video:video>
  </url>`;
      }
    }

    xml += '\n</urlset>';

    res.header('Content-Type', 'application/xml');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating video sitemap:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Internal Server Error</error>');
  }
};

// @desc    Get products by occasion slug
// @route   GET /api/products/by-occasion/:slug
// @access  Public
const getProductsByOccasionSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const Occasion = require('../models/Occasion');
    const Category = require('../models/Category');

    let occasionDoc = await Occasion.findOne({ slug: slug.toLowerCase() });
    let occasionData = occasionDoc ? (typeof occasionDoc.toObject === 'function' ? occasionDoc.toObject() : occasionDoc) : null;

    if (!occasionData) {
      const cat = await Category.findOne({ slug: slug.toLowerCase() });
      if (cat) {
        const catObj = typeof cat.toObject === 'function' ? cat.toObject() : cat;
        occasionData = {
          _id: catObj._id || catObj.id,
          id: catObj._id || catObj.id,
          name: catObj.name,
          slug: catObj.slug,
          description: catObj.description || `Explore our beautiful ${catObj.name} collection`,
          image: catObj.image || null,
          icon: catObj.icon || 'Gift',
          banner: catObj.banner || null
        };
      } else {
        const formattedTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        occasionData = {
          _id: slug,
          id: slug,
          name: formattedTitle,
          slug: slug,
          description: `Explore our beautiful ${formattedTitle} collection`,
          image: null,
          icon: 'Gift',
          banner: null
        };
      }
    }

    const matchingProducts = (await getProductsForOccasion(slug)).filter(p => !p.hidden);

    // Keep exact matching products without fallback slice so empty occasions return empty list
    const sortedProducts = await applySavedSortingToProducts(matchingProducts, `occasion:${slug}`);
    const productsWithReviews = await addReviewStats(sortedProducts);

    res.json({
      occasion: occasionData,
      products: productsWithReviews,
      total: productsWithReviews.length
    });
  } catch (error) {
    console.error('Error fetching products by occasion:', error);
    res.status(500).json({ message: 'Error fetching products by occasion', error: error.message });
  }
};

// @desc    Get enterprise overview analytics stats
// @route   GET /api/products/admin/overview-stats
// @access  Private/Admin
const getOverviewStats = asyncHandler(async (req, res) => {
  const allProducts = await Product.find({});
  const totalProducts = allProducts.length;
  const activeProducts = allProducts.filter(p => !p.hidden && p.status !== 'draft' && p.status !== 'archived').length;
  const outOfStock = allProducts.filter(p => (p.countInStock || 0) <= 0).length;
  const hiddenProducts = allProducts.filter(p => p.hidden || p.status === 'hidden').length;
  const draftProducts = allProducts.filter(p => p.status === 'draft').length;
  const lowInventoryCount = allProducts.filter(p => (p.countInStock || 0) > 0 && (p.countInStock || 0) <= 5).length;
  const pendingReviewCount = allProducts.filter(p => p.approvalStatus === 'pending').length;

  // Rating average
  const totalRating = allProducts.reduce((acc, p) => acc + (p.rating || 0), 0);
  const averageRating = totalProducts > 0 ? (totalRating / totalProducts).toFixed(1) : '0.0';

  // Product Type Distribution
  const typeMap = {};
  allProducts.forEach(p => {
    const type = p.catalogType || 'bouquet';
    typeMap[type] = (typeMap[type] || 0) + 1;
  });

  // Category Breakdown
  const categoryMap = {};
  allProducts.forEach(p => {
    const cat = p.category || 'Uncategorized';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  let bestSellingCategory = 'Bouquets';
  let maxCatCount = 0;
  Object.entries(categoryMap).forEach(([cat, count]) => {
    if (count > maxCatCount) {
      maxCatCount = count;
      bestSellingCategory = cat;
    }
  });

  // Recently updated (last 10)
  const recentlyUpdated = [...allProducts]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 8);

  // Recently added (last 8)
  const recentlyAdded = [...allProducts]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  res.json({
    totalProducts,
    activeProducts,
    outOfStock,
    hiddenProducts,
    draftProducts,
    bestSellingCategory,
    recentlyAdded,
    lowInventoryCount,
    averageRating: parseFloat(averageRating),
    pendingReviewCount,
    typeDistribution: typeMap,
    categoryDistribution: categoryMap,
    recentlyUpdated,
  });
});

const getProductsByCatalogType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  
  let query = {};
  if (type === 'cake') {
    query = {
      $or: [
        { catalogType: 'cake' },
        { category: { $regex: /cake/i } }
      ]
    };
  } else if (type === 'plant') {
    query = {
      $or: [
        { catalogType: 'plant' },
        { category: { $regex: /plant/i } }
      ]
    };
  } else if (type === 'chocolate') {
    query = {
      $and: [
        {
          $or: [
            { catalogType: 'chocolate' },
            { category: { $regex: /chocolate|confectionery|sweets/i } }
          ]
        },
        { catalogType: { $ne: 'bouquet' } },
        { title: { $not: { $regex: /bouquet/i } } },
        { subcategory: { $not: { $regex: /bouquet/i } } },
        { category: { $not: { $regex: /bouquet/i } } }
      ]
    };
  } else if (type === 'hamper') {
    query = {
      $or: [
        { catalogType: 'hamper' },
        { category: { $regex: /hamper|basket|gift/i } }
      ]
    };
  } else if (type === 'combo') {
    query = {
      $or: [
        { catalogType: 'combo' },
        { category: { $regex: /combo/i } }
      ]
    };
  } else if (type === 'addon') {
    query = {
      $or: [
        { catalogType: 'addon' },
        { category: { $regex: /addon|add-on|greeting|card|teddy|balloon/i } }
      ]
    };
  } else if (type === 'bouquet') {
    query = {
      $and: [
        {
          $or: [
            { catalogType: 'bouquet' },
            { catalogType: { $exists: false } },
            { catalogType: null },
            { catalogType: '' },
            { title: { $regex: /bouquet/i } },
            { subcategory: { $regex: /bouquet/i } },
            { category: { $regex: /bouquet/i } }
          ]
        },
        { category: { $not: { $regex: /cake|plant|hamper|combo|addon|greeting|card|teddy|balloon/i } } }
      ]
    };
  } else {
    query = { catalogType: type };
  }

  const products = await Product.find(query).sort({ createdAt: -1 });
  const productsWithReviews = await addReviewStats(products);
  res.json({ products: productsWithReviews, total: products.length });
});

// @desc    Perform enterprise bulk operations on products
// @route   POST /api/products/admin/bulk-action
// @access  Private/Admin
const executeBulkAction = asyncHandler(async (req, res) => {
  const { action, productIds, payload } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    res.status(400);
    throw new Error('No product IDs provided');
  }

  let modifiedCount = 0;

  switch (action) {
    case 'publish':
      const publishRes = await Product.updateMany({ _id: { $in: productIds } }, { hidden: false, status: 'published' });
      modifiedCount = publishRes.modifiedCount;
      break;
    case 'hide':
      const hideRes = await Product.updateMany({ _id: { $in: productIds } }, { hidden: true, status: 'hidden' });
      modifiedCount = hideRes.modifiedCount;
      break;
    case 'delete':
      const delRes = await Product.deleteMany({ _id: { $in: productIds } });
      modifiedCount = delRes.deletedCount;
      break;
    case 'category':
    case 'bulk_category_taxonomy': {
      const {
        primaryCategory,
        changePrimaryCategory,
        subcategory,
        changeSubcategory,
        clearSubcategory,
        isNewSubcategory,
        additionalCategories,
        changeAdditionalCategories,
        additionalCategoriesMode = 'append',
        catalogType,
      } = payload || {};

      // Support simple legacy payload { category: "..." } or new structured payload
      const effectivePrimaryCategory = primaryCategory || payload?.category;
      const willChangePrimary = changePrimaryCategory !== undefined ? Boolean(changePrimaryCategory) : Boolean(payload?.category);
      const willChangeSubcategory = Boolean(changeSubcategory);
      const willChangeAdditional = Boolean(changeAdditionalCategories);

      if (!willChangePrimary && !willChangeSubcategory && !willChangeAdditional) {
        res.status(400);
        throw new Error('No taxonomy updates specified (select primary category, subcategory, or additional categories to update).');
      }

      // 1. Fetch DB Categories from Prisma for relation matching & auto-creation
      const prismaClient = require('../config/prisma');
      const allDbCategories = await prismaClient.category.findMany({
        select: { id: true, name: true, slug: true, parentId: true }
      });

      const catMap = new Map();
      allDbCategories.forEach(c => {
        catMap.set(c.id.toLowerCase(), c.id);
        catMap.set(c.name.toLowerCase().trim(), c.id);
        catMap.set(c.slug.toLowerCase().trim(), c.id);
      });

      // 2. If isNewSubcategory is true and subcategory is provided, ensure it's registered in Category table
      if (isNewSubcategory && subcategory && subcategory.trim()) {
        const subName = subcategory.trim();
        const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        let existingSub = allDbCategories.find(c =>
          c.slug.toLowerCase() === subSlug || c.name.toLowerCase() === subName.toLowerCase()
        );

        if (!existingSub) {
          let parentCatId = null;
          if (effectivePrimaryCategory) {
            const matchedParent = allDbCategories.find(c =>
              c.name.toLowerCase() === effectivePrimaryCategory.toLowerCase().trim() ||
              c.slug.toLowerCase() === effectivePrimaryCategory.toLowerCase().trim()
            );
            if (matchedParent) parentCatId = matchedParent.id;
          }

          try {
            const newCat = await prismaClient.category.create({
              data: {
                id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: subName,
                slug: subSlug,
                parentId: parentCatId,
                isActive: true,
                displayOrder: 0
              }
            });
            catMap.set(newCat.name.toLowerCase().trim(), newCat.id);
            catMap.set(newCat.slug.toLowerCase().trim(), newCat.id);
          } catch (createCatErr) {
            console.warn('Could not auto-create subcategory in Category model:', createCatErr.message);
          }
        }
      }

      // 3. Fetch all products to update
      const productsToUpdate = await Product.find({ _id: { $in: productIds } });

      for (const prod of productsToUpdate) {
        let detailsObj = (prod.details && typeof prod.details === 'object') ? { ...prod.details } : {};
        let updatedCategories = Array.isArray(prod.categories) ? [...prod.categories] : (prod.category ? [prod.category] : []);

        // A. Primary Category Update
        if (willChangePrimary && effectivePrimaryCategory) {
          const cleanPrim = String(effectivePrimaryCategory).trim();
          prod.category = cleanPrim;
          if (catalogType) {
            prod.catalogType = catalogType;
          }
          if (!updatedCategories.some(c => String(c).toLowerCase().trim() === cleanPrim.toLowerCase())) {
            updatedCategories.unshift(cleanPrim);
          }
        }

        // B. Subcategory Update
        if (willChangeSubcategory) {
          if (clearSubcategory) {
            prod.subcategory = '';
            detailsObj.subcategory = '';
          } else if (subcategory) {
            const cleanSub = String(subcategory).trim();
            prod.subcategory = cleanSub;
            detailsObj.subcategory = cleanSub;
          }
        }

        // C. Additional Categories Update
        if (willChangeAdditional && Array.isArray(additionalCategories)) {
          const cleanAdditional = additionalCategories
            .map(c => String(c).trim())
            .filter(Boolean);

          if (additionalCategoriesMode === 'replace') {
            const primary = prod.category ? [prod.category] : [];
            const combined = [...primary, ...cleanAdditional];
            const seen = new Set();
            updatedCategories = [];
            for (const item of combined) {
              const lower = item.toLowerCase();
              if (!seen.has(lower)) {
                seen.add(lower);
                updatedCategories.push(item);
              }
            }
          } else {
            const seen = new Set(updatedCategories.map(c => String(c).toLowerCase().trim()));
            for (const item of cleanAdditional) {
              const lower = item.toLowerCase();
              if (!seen.has(lower)) {
                seen.add(lower);
                updatedCategories.push(item);
              }
            }
          }
        }

        // Apply updated categories list
        prod.categories = updatedCategories;
        detailsObj.categories = updatedCategories;
        prod.details = detailsObj;

        // Add audit activity log
        if (!Array.isArray(prod.activityLogs)) {
          prod.activityLogs = [];
        }
        prod.activityLogs.push({
          action: 'bulk_category_taxonomy_updated',
          performedBy: req.user ? req.user.name : 'Admin',
          details: `Bulk Taxonomy Update: Primary='${prod.category}', Subcategory='${prod.subcategory || 'None'}', Total Categories=${prod.categories.length}`,
          timestamp: new Date()
        });

        await prod.save();

        // 4. Synchronize Prisma ProductCategory join table records
        try {
          const targetCategoryIds = new Set();
          for (const catName of prod.categories) {
            const matchedId = catMap.get(String(catName).toLowerCase().trim());
            if (matchedId) {
              targetCategoryIds.add(matchedId);
            }
          }

          if (targetCategoryIds.size > 0) {
            await prismaClient.productCategory.deleteMany({
              where: { productId: String(prod._id || prod.id) }
            });

            for (const cId of targetCategoryIds) {
              await prismaClient.productCategory.create({
                data: {
                  productId: String(prod._id || prod.id),
                  categoryId: cId
                }
              }).catch(() => {});
            }
          }
        } catch (syncErr) {
          console.warn(`ProductCategory sync error for ${prod._id}:`, syncErr.message);
        }

        modifiedCount++;
      }
      break;
    }
    case 'discount':
      if (typeof payload?.discount !== 'number') {
        res.status(400);
        throw new Error('Valid discount number required');
      }
      const discRes = await Product.updateMany({ _id: { $in: productIds } }, { discount: payload.discount });
      modifiedCount = discRes.modifiedCount;
      break;
    case 'stock':
      if (typeof payload?.countInStock !== 'number') {
        res.status(400);
        throw new Error('Valid stock count required');
      }
      const stockRes = await Product.updateMany({ _id: { $in: productIds } }, { countInStock: payload.countInStock });
      modifiedCount = stockRes.modifiedCount;
      break;
    case 'duplicate':
      const productsToDup = await Product.find({ _id: { $in: productIds } });
      for (const prod of productsToDup) {
        const dupData = prod.toObject();
        delete dupData._id;
        delete dupData.createdAt;
        delete dupData.updatedAt;
        dupData.title = `${dupData.title} (Copy)`;
        dupData.sku = dupData.sku ? `${dupData.sku}-COPY` : '';
        await Product.create(dupData);
      }
      modifiedCount = productsToDup.length;
      break;
    case 'sameday_enable':
      const sameDayOnRes = await Product.updateMany({ _id: { $in: productIds } }, { sameDay: true });
      modifiedCount = sameDayOnRes.modifiedCount;
      break;
    case 'sameday_disable':
      const sameDayOffRes = await Product.updateMany({ _id: { $in: productIds } }, { sameDay: false });
      modifiedCount = sameDayOffRes.modifiedCount;
      break;
    case 'featured_enable':
      const featOnRes = await Product.updateMany({ _id: { $in: productIds } }, { isFeatured: true });
      modifiedCount = featOnRes.modifiedCount;
      break;
    case 'featured_disable':
      const featOffRes = await Product.updateMany({ _id: { $in: productIds } }, { isFeatured: false });
      modifiedCount = featOffRes.modifiedCount;
      break;
    case 'new_enable':
      const newOnRes = await Product.updateMany({ _id: { $in: productIds } }, { isNew: true, isNewArrival: true });
      modifiedCount = newOnRes.modifiedCount;
      break;
    case 'new_disable':
      const newOffRes = await Product.updateMany({ _id: { $in: productIds } }, { isNew: false, isNewArrival: false });
      modifiedCount = newOffRes.modifiedCount;
      break;
    default:
      res.status(400);
      throw new Error(`Unsupported bulk action: ${action}`);
  }

  res.json({ success: true, action, modifiedCount, message: `Successfully executed ${action} on ${modifiedCount} products.` });
});

// @desc    Restore past version from product version history
// @route   POST /api/products/:id/restore-version
// @access  Private/Admin
const restoreProductVersion = asyncHandler(async (req, res) => {
  const { versionIndex } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (!product.versionHistory || !product.versionHistory[versionIndex]) {
    res.status(400);
    throw new Error('Invalid version index');
  }

  const targetVersionData = product.versionHistory[versionIndex].data;
  if (!targetVersionData) {
    res.status(400);
    throw new Error('Version data unavailable for restoration');
  }

  // Restore fields
  Object.keys(targetVersionData).forEach(key => {
    if (key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
      product[key] = targetVersionData[key];
    }
  });

  if (Array.isArray(product.activityLogs)) {
    product.activityLogs.push({
      action: 'version_restored',
      performedBy: req.user ? req.user.name : 'Admin',
      details: `Restored version`,
      timestamp: new Date(),
    });
  }

  await product.save();
  res.json({ success: true, message: 'Product version restored successfully', product });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByOccasionSlug,
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
  bulkUpdateValentineSettings,
  getSectionProductsForSorting,
  updateSectionProductsOrder,
  bulkUpdateSectionProducts,
  resetSectionProductsOrder,
  bulkReorderProducts,
  getOrderAuditLogs,
  rollbackOrderChanges,
  applySavedSortingToProducts,
  getSharePreview,
  getVideoSitemap,
  getOverviewStats,
  getProductsByCatalogType,
  executeBulkAction,
  restoreProductVersion,
};

