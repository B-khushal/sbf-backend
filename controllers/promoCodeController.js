const PromoCode = require('../models/PromoCode');

// Get all promo codes (admin only)
exports.getAllPromoCodes = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'metadata.campaignName': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status === 'active') {
      const now = new Date();
      query.isActive = true;
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const [promoCodes, total] = await Promise.all([
      PromoCode.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean(),
      PromoCode.countDocuments(query)
    ]);
    
    // Add computed fields
    const now = new Date();
    const enrichedPromoCodes = promoCodes.map(code => ({
      ...code,
      isCurrentlyValid: code.isActive && 
                       code.validFrom <= now && 
                       code.validUntil >= now &&
                       (code.usageLimit === null || code.usedCount < code.usageLimit),
      remainingUses: code.usageLimit ? Math.max(0, code.usageLimit - code.usedCount) : null,
      usagePercentage: code.usageLimit ? Math.round((code.usedCount / code.usageLimit) * 100) : 0
    }));
    
    res.json({
      success: true,
      data: enrichedPromoCodes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching promo codes',
      error: error.message
    });
  }
};

// Get single promo code by ID (admin only)
exports.getPromoCodeById = async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('applicableProducts', 'name price category')
      .populate('excludedProducts', 'name price category');
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    console.error('Error fetching promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching promo code',
      error: error.message
    });
  }
};

// Create new promo code (admin only)
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      description,
      image,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      usageLimit,
      validFrom,
      validUntil,
      isActive,
      applicableCategories,
      excludedCategories,
      applicableProducts,
      excludedProducts,
      firstTimeUserOnly,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!code || !description || !discountType || discountValue === undefined || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, description, discountType, discountValue, validUntil'
      });
    }
    
    // Validate discount value based on type
    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount must be between 0 and 100'
      });
    }
    
    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed discount must be greater than 0'
      });
    }
    
    // Validate date range
    const fromDate = new Date(validFrom || Date.now());
    const untilDate = new Date(validUntil);
    
    if (untilDate <= fromDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date'
      });
    }
    
    // Check if promo code already exists
    const existingCode = await PromoCode.findOne({ 
      code: code.toUpperCase() 
    });
    
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }
    
    // Create new promo code
    const promoCode = new PromoCode({
      code: code.toUpperCase(),
      description,
      image: image || null,
      discountType,
      discountValue,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscountAmount: maximumDiscountAmount || null,
      usageLimit: usageLimit || null,
      validFrom: fromDate,
      validUntil: untilDate,
      isActive: isActive !== undefined ? isActive : true,
      applicableCategories: applicableCategories || [],
      excludedCategories: excludedCategories || [],
      applicableProducts: applicableProducts || [],
      excludedProducts: excludedProducts || [],
      firstTimeUserOnly: firstTimeUserOnly || false,
      createdBy: req.user._id,
      metadata: metadata || {}
    });
    
    await promoCode.save();
    
    // Populate created promo code for response
    await promoCode.populate('createdBy', 'name email');
    
    console.log(`✅ Promo code created: ${promoCode.code} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Promo code created successfully',
      data: promoCode
    });
  } catch (error) {
    console.error('Error creating promo code:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating promo code',
      error: error.message
    });
  }
};

// Update promo code (admin only)
exports.updatePromoCode = async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    // Prevent updating code if it has been used
    if (req.body.code && req.body.code !== promoCode.code && promoCode.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change code of a promo code that has been used'
      });
    }
    
    // Update fields
    const updateFields = [
      'code', 'description', 'image', 'discountType', 'discountValue',
      'minimumOrderAmount', 'maximumDiscountAmount', 'usageLimit',
      'validFrom', 'validUntil', 'isActive', 'applicableCategories',
      'excludedCategories', 'applicableProducts', 'excludedProducts',
      'firstTimeUserOnly', 'metadata'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'code') {
          promoCode[field] = req.body[field].toUpperCase();
        } else {
          promoCode[field] = req.body[field];
        }
      }
    });
    
    // Validate discount value if changed
    if (req.body.discountType || req.body.discountValue !== undefined) {
      const discountType = req.body.discountType || promoCode.discountType;
      const discountValue = req.body.discountValue !== undefined ? req.body.discountValue : promoCode.discountValue;
      
      if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount must be between 0 and 100'
        });
      }
      
      if (discountType === 'fixed' && discountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Fixed discount must be greater than 0'
        });
      }
    }
    
    // Validate date range if changed
    if (req.body.validFrom || req.body.validUntil) {
      const fromDate = new Date(req.body.validFrom || promoCode.validFrom);
      const untilDate = new Date(req.body.validUntil || promoCode.validUntil);
      
      if (untilDate <= fromDate) {
        return res.status(400).json({
          success: false,
          message: 'Valid until date must be after valid from date'
        });
      }
    }
    
    await promoCode.save();
    
    // Populate updated promo code for response
    await promoCode.populate('createdBy', 'name email');
    
    console.log(`✅ Promo code updated: ${promoCode.code} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Promo code updated successfully',
      data: promoCode
    });
  } catch (error) {
    console.error('Error updating promo code:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating promo code',
      error: error.message
    });
  }
};

// Delete promo code (admin only)
exports.deletePromoCode = async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id);
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    // Check if promo code has been used
    if (promoCode.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a promo code that has been used. Consider deactivating it instead.',
        suggestion: 'Set isActive to false to disable the promo code'
      });
    }
    
    await PromoCode.findByIdAndDelete(req.params.id);
    
    console.log(`🗑️ Promo code deleted: ${promoCode.code} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting promo code',
      error: error.message
    });
  }
};

// Validate promo code (public - for checkout)
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, orderAmount, items = [], userId } = req.body;
    
    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Promo code and order amount are required'
      });
    }
    
    // Find promo code
    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }
    
    // Check if promo code is applicable
    const applicabilityCheck = promoCode.isApplicableToOrder({
      totalAmount: orderAmount,
      items,
      userId
    });
    
    if (!applicabilityCheck.valid) {
      return res.status(400).json({
        success: false,
        message: applicabilityCheck.reason
      });
    }
    
    // Calculate discount
    const discountAmount = promoCode.calculateDiscount(orderAmount);
    const finalAmount = Math.max(0, orderAmount - discountAmount);
    
    res.json({
      success: true,
      message: 'Promo code is valid',
      data: {
        promoCode: {
          id: promoCode._id,
          code: promoCode.code,
          description: promoCode.description,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue
        },
        discount: {
          amount: discountAmount,
          percentage: Math.round((discountAmount / orderAmount) * 100),
          savings: discountAmount
        },
        order: {
          originalAmount: orderAmount,
          discountAmount: discountAmount,
          finalAmount: finalAmount
        }
      }
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating promo code',
      error: error.message
    });
  }
};

// Apply promo code to order (used during order processing)
exports.applyPromoCode = async (req, res) => {
  try {
    const { code, orderId } = req.body;
    
    if (!code || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Promo code and order ID are required'
      });
    }
    
    // Find and increment usage
    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });
    
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }
    
    // Increment usage count
    await promoCode.incrementUsage();
    
    console.log(`🎟️ Promo code applied: ${code} for order ${orderId}`);
    
    res.json({
      success: true,
      message: 'Promo code applied successfully',
      data: {
        code: promoCode.code,
        newUsageCount: promoCode.usedCount
      }
    });
  } catch (error) {
    console.error('Error applying promo code:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying promo code',
      error: error.message
    });
  }
};

// Get promo code statistics (admin only)
exports.getPromoCodeStats = async (req, res) => {
  try {
    const now = new Date();
    
    const [
      totalPromoCodes,
      activePromoCodes,
      expiredPromoCodes,
      totalUsage,
      topPromoCodes
    ] = await Promise.all([
      PromoCode.countDocuments(),
      PromoCode.countDocuments({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      }),
      PromoCode.countDocuments({
        validUntil: { $lt: now }
      }),
      PromoCode.aggregate([
        { $group: { _id: null, totalUsed: { $sum: '$usedCount' } } }
      ]),
      PromoCode.find()
        .sort({ usedCount: -1 })
        .limit(5)
        .select('code description usedCount discountType discountValue')
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          total: totalPromoCodes,
          active: activePromoCodes,
          expired: expiredPromoCodes,
          inactive: totalPromoCodes - activePromoCodes - expiredPromoCodes
        },
        usage: {
          totalApplications: totalUsage[0]?.totalUsed || 0,
          averageUsagePerCode: totalPromoCodes > 0 ? Math.round((totalUsage[0]?.totalUsed || 0) / totalPromoCodes) : 0
        },
        topPerforming: topPromoCodes
      }
    });
  } catch (error) {
    console.error('Error fetching promo code stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching promo code statistics',
      error: error.message
    });
  }
}; 