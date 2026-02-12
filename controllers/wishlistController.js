const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist.productId',
      select: 'title price images discount category description'
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        wishlist: [],
        itemCount: 0
      });
    }

    // Transform wishlist items to include product details
    const wishlistItems = user.wishlist.map(item => ({
      id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.productId.price,
      image: item.productId.images?.[0] || '',
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      wishlist: wishlistItems,
      itemCount: wishlistItems.length
    });
  } catch (error) {
    console.error('Error getting wishlist:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      wishlist: [],
      itemCount: 0
    });
  }
};

// @desc    Add item to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ 
        success: false,
        message: 'Product ID is required',
        wishlist: [],
        itemCount: 0
      });
    }

    // Validate product exists and is not hidden
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found',
        wishlist: [],
        itemCount: 0
      });
    }
    
    if (product.hidden) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found',
        wishlist: [],
        itemCount: 0
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        wishlist: [],
        itemCount: 0
      });
    }

    // Check if item already exists in wishlist
    const existingItem = user.wishlist.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({ 
        success: false,
        message: 'Product already in wishlist',
        wishlist: [],
        itemCount: 0
      });
    }

    // Add new item to wishlist
    user.wishlist.push({
      productId,
      addedAt: new Date()
    });

    await user.save();

    // Return updated wishlist
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'wishlist.productId',
      select: 'title price images discount category description'
    });

    const wishlistItems = updatedUser.wishlist.map(item => ({
      id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.productId.price,
      image: item.productId.images?.[0] || '',
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      message: 'Item added to wishlist successfully',
      wishlist: wishlistItems,
      itemCount: wishlistItems.length
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      wishlist: [],
      itemCount: 0
    });
  }
};

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ 
        success: false,
        message: 'Product ID is required',
        wishlist: [],
        itemCount: 0
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        wishlist: [],
        itemCount: 0
      });
    }

    // Check if item exists in wishlist before removing
    const itemExists = user.wishlist.some(
      item => item.productId.toString() === productId
    );

    if (!itemExists) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found in wishlist',
        wishlist: [],
        itemCount: 0
      });
    }

    user.wishlist = user.wishlist.filter(
      item => item.productId.toString() !== productId
    );

    await user.save();

    // Return updated wishlist
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'wishlist.productId',
      select: 'title price images discount category description'
    });

    const wishlistItems = updatedUser.wishlist.map(item => ({
      id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.productId.price,
      image: item.productId.images?.[0] || '',
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully',
      wishlist: wishlistItems,
      itemCount: wishlistItems.length
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      wishlist: [],
      itemCount: 0
    });
  }
};

// @desc    Clear user's wishlist
// @route   DELETE /api/wishlist
// @access  Private
const clearWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found',
        wishlist: [],
        itemCount: 0
      });
    }

    user.wishlist = [];
    await user.save();

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      wishlist: [],
      itemCount: 0
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      wishlist: [],
      itemCount: 0
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
}; 