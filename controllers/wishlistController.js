const User = require('../models/User');
const Product = require('../models/Product');

const formatWishlistItems = (wishlistArray) => {
  if (!Array.isArray(wishlistArray)) return [];
  return wishlistArray.map(item => {
    const prod = (item.product && typeof item.product === 'object') 
      ? item.product 
      : ((item.productId && typeof item.productId === 'object') ? item.productId : null);
    
    const prodId = prod ? (prod._id || prod.id) : String(item.productId || item.id || '');
    const title = prod ? (prod.title || prod.name) : (item.title || item.name || '');
    const price = prod ? (typeof prod.price === 'number' ? prod.price : parseFloat(prod.price || 0)) : (item.price || 0);
    const images = prod ? (Array.isArray(prod.images) ? prod.images.map(i => typeof i === 'string' ? i : i.url) : []) : (item.images || []);
    const image = images[0] || (prod ? prod.image : '') || item.image || '/images/placeholder.svg';

    return {
      id: String(prodId),
      productId: String(prodId),
      title: String(title),
      price: Number(price),
      image: String(image),
      images,
      discount: prod?.discount || item.discount || 0,
      category: prod?.category || item.category || '',
      description: prod?.description || item.description || '',
      addedAt: item.addedAt || new Date()
    };
  }).filter(i => Boolean(i.id && i.title));
};

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
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

    const wishlistItems = formatWishlistItems(user.wishlist);

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
    const targetIdStr = String(productId);
    const existingItem = user.wishlist.find(item => {
      const pId = String(item.productId?._id || item.productId?.id || item.productId || item.id || '');
      return pId === targetIdStr;
    });

    if (existingItem) {
      const existingItems = formatWishlistItems(user.wishlist);
      return res.status(400).json({ 
        success: false,
        message: 'Product already in wishlist',
        wishlist: existingItems,
        itemCount: existingItems.length
      });
    }

    // Add new item to wishlist
    user.wishlist.push({
      productId: targetIdStr,
      product: product,
      addedAt: new Date()
    });

    await user.save();

    const updatedUser = await User.findById(req.user._id);
    const wishlistItems = formatWishlistItems(updatedUser.wishlist);

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

    const targetIdStr = String(productId);
    user.wishlist = user.wishlist.filter(item => {
      const pId = String(item.productId?._id || item.productId?.id || item.productId || item.id || '');
      return pId !== targetIdStr;
    });

    await user.save();

    const updatedUser = await User.findById(req.user._id);
    const wishlistItems = formatWishlistItems(updatedUser.wishlist);

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully',
      wishlist: wishlistItems,
      itemCount: wishlistItems.length
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
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