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
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add item to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if item already exists in wishlist
    const existingItem = user.wishlist.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({ message: 'Product already in wishlist' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Clear user's wishlist
// @route   DELETE /api/wishlist
// @access  Private
const clearWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
}; 