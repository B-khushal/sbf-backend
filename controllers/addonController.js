const AddonProduct = require('../models/AddonProduct');
const Product = require('../models/Product');
const { logActivity } = require('../utils/activityLogger');

// @desc    Get all addon products (public/admin)
// @route   GET /api/addons
// @access  Public
const getAddons = async (req, res) => {
  try {
    const { category, status, search, limit = 100, page = 1 } = req.query;
    
    let query = {};
    
    // Admin filtering vs Public filtering
    if (status) {
      if (status !== 'all') {
        query.status = status;
      }
    } else {
      // By default, public should only see active addons
      query.status = 'active';
      query.active = true;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { SKU: searchRegex },
        { description: searchRegex }
      ];
    }
    
    const pageSize = parseInt(limit);
    const skip = (parseInt(page) - 1) * pageSize;
    
    const total = await AddonProduct.countDocuments(query);
    const addons = await AddonProduct.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize);
      
    res.json({
      success: true,
      addons,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching addons:', error);
    res.status(500).json({ success: false, message: 'Server error fetching addons' });
  }
};

// @desc    Fetch recommended addons based on cart items
// @route   POST /api/addons/recommendations
// @access  Public
const getRecommendedAddons = async (req, res) => {
  try {
    const { items = [] } = req.body;
    
    // Fetch all active addons
    const activeAddons = await AddonProduct.find({ active: true, status: 'active' })
      .sort({ sortOrder: 1, createdAt: -1 });
      
    if (items.length === 0) {
      // Return bestselling/highest sorted addons as fallback
      return res.json({
        success: true,
        addons: activeAddons.slice(0, 8)
      });
    }
    
    // Extract info from cart items
    const cartProductIds = items.map(item => String(item.productId || item.product || item._id));
    const cartCategories = items.map(item => String(item.category || '').toLowerCase());
    const cartTitles = items.map(item => String(item.title || '').toLowerCase());
    
    // Scoring engine for recommendations
    const scoredAddons = activeAddons.map(addon => {
      let score = 0;
      
      // 1. Linked specifically to a product in the cart
      if (addon.linkedProducts && addon.linkedProducts.length > 0) {
        const hasProductMatch = addon.linkedProducts.some(lpId => 
          cartProductIds.includes(String(lpId))
        );
        if (hasProductMatch) score += 10;
      }
      
      // 2. Linked to a category in the cart
      if (addon.linkedCategories && addon.linkedCategories.length > 0) {
        const hasCategoryMatch = addon.linkedCategories.some(lc => 
          cartCategories.includes(lc.toLowerCase())
        );
        if (hasCategoryMatch) score += 5;
      }
      
      // 3. Linked to an occasion in the cart (Birthday / Anniversary detection in titles)
      if (addon.linkedOccasions && addon.linkedOccasions.length > 0) {
        const hasOccasionMatch = addon.linkedOccasions.some(occasion => {
          const occLower = occasion.toLowerCase();
          return cartTitles.some(title => title.includes(occLower)) || 
                 cartCategories.some(cat => cat.includes(occLower));
        });
        if (hasOccasionMatch) score += 3;
      }
      
      return { addon, score };
    });
    
    // Sort by score first, then by sortOrder
    scoredAddons.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.addon.sortOrder - b.addon.sortOrder;
    });
    
    const recommendedAddons = scoredAddons.map(item => item.addon);
    
    res.json({
      success: true,
      addons: recommendedAddons.slice(0, 10)
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ success: false, message: 'Server error loading recommendations' });
  }
};

// @desc    Create new addon product
// @route   POST /api/addons
// @access  Private/Admin
const createAddon = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      category,
      image,
      galleryImages,
      price,
      discountedPrice,
      stock,
      SKU,
      status,
      tags,
      badge,
      linkedCategories,
      linkedOccasions,
      linkedProducts,
      active,
      sortOrder
    } = req.body;
    
    // Check if slug is unique
    const slugExists = await AddonProduct.findOne({ slug: slug.toLowerCase() });
    if (slugExists) {
      return res.status(400).json({ success: false, message: 'An addon with this slug already exists' });
    }
    
    const addon = new AddonProduct({
      name,
      slug,
      description,
      category,
      image,
      galleryImages,
      price,
      discountedPrice,
      stock,
      SKU,
      status,
      tags,
      badge,
      linkedCategories,
      linkedOccasions,
      linkedProducts,
      active,
      sortOrder
    });
    
    const savedAddon = await addon.save();
    
    res.status(201).json({
      success: true,
      message: 'Addon created successfully',
      addon: savedAddon
    });
    
    await logActivity({
      req,
      actionType: 'Create Addon',
      method: 'POST',
      status: 'Success',
      metadata: {
        addonId: savedAddon._id,
        name: savedAddon.name
      }
    });
  } catch (error) {
    console.error('Error creating addon:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating addon' });
  }
};

// @desc    Update addon product
// @route   PUT /api/addons/:id
// @access  Private/Admin
const updateAddon = async (req, res) => {
  try {
    const { id } = req.params;
    
    const addon = await AddonProduct.findById(id);
    if (!addon) {
      return res.status(404).json({ success: false, message: 'Addon product not found' });
    }
    
    // Update fields
    const fieldsToUpdate = [
      'name', 'slug', 'description', 'category', 'image', 'galleryImages',
      'price', 'discountedPrice', 'stock', 'SKU', 'status', 'tags', 'badge',
      'linkedCategories', 'linkedOccasions', 'linkedProducts', 'active', 'sortOrder'
    ];
    
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        addon[field] = req.body[field];
      }
    });
    
    const updatedAddon = await addon.save();
    
    res.json({
      success: true,
      message: 'Addon updated successfully',
      addon: updatedAddon
    });
    
    await logActivity({
      req,
      actionType: 'Update Addon',
      method: 'PUT',
      status: 'Success',
      metadata: {
        addonId: updatedAddon._id,
        name: updatedAddon.name
      }
    });
  } catch (error) {
    console.error('Error updating addon:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating addon' });
  }
};

// @desc    Delete addon product
// @route   DELETE /api/addons/:id
// @access  Private/Admin
const deleteAddon = async (req, res) => {
  try {
    const { id } = req.params;
    
    const addon = await AddonProduct.findById(id);
    if (!addon) {
      return res.status(404).json({ success: false, message: 'Addon product not found' });
    }
    
    await addon.deleteOne();
    
    res.json({
      success: true,
      message: 'Addon product deleted successfully'
    });
    
    await logActivity({
      req,
      actionType: 'Delete Addon',
      method: 'DELETE',
      status: 'Success',
      metadata: {
        addonId: id,
        name: addon.name
      }
    });
  } catch (error) {
    console.error('Error deleting addon:', error);
    res.status(500).json({ success: false, message: 'Server error deleting addon' });
  }
};

module.exports = {
  getAddons,
  getRecommendedAddons,
  createAddon,
  updateAddon,
  deleteAddon
};
