const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNewArrival isFeatured'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Transform cart items to include product details
    const cartItems = user.cart.map(item => ({
      _id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.customPrice !== undefined ? item.customPrice : item.productId.price,
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      careInstructions: item.productId.careInstructions,
      isNewArrival: item.productId.isNewArrival,
      isFeatured: item.productId.isFeatured,
      customizations: item.customizations,
      selectedVariant: item.selectedVariant,
      quantity: item.quantity,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      cart: cartItems,
      itemCount: cartItems.length
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, customizations, customPrice, selectedVariant } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Validate product exists and is not hidden
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (product.hidden) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if item already exists in cart (same productId, customizations, and selectedVariant)
    const existingItemIndex = user.cart.findIndex(
      item => item.productId.toString() === productId && 
              JSON.stringify(item.customizations) === JSON.stringify(customizations) &&
              JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      user.cart[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      user.cart.push({
        productId,
        quantity,
        addedAt: new Date(),
        customizations: customizations,
        customPrice: customPrice,
        selectedVariant: selectedVariant
      });
    }

    await user.save();

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNewArrival isFeatured'
    });

    const cartItems = updatedUser.cart.map(item => ({
      _id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.customPrice !== undefined ? item.customPrice : item.productId.price,
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      careInstructions: item.productId.careInstructions,
      isNewArrival: item.productId.isNewArrival,
      isFeatured: item.productId.isFeatured,
      customizations: item.customizations,
      selectedVariant: item.selectedVariant,
      quantity: item.quantity,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:productId
// @access  Private
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const itemIndex = user.cart.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    user.cart[itemIndex].quantity = quantity;
    await user.save();

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNewArrival isFeatured'
    });

    const cartItems = updatedUser.cart.map(item => ({
      _id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.customPrice !== undefined ? item.customPrice : item.productId.price,
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      careInstructions: item.productId.careInstructions,
      isNewArrival: item.productId.isNewArrival,
      isFeatured: item.productId.isFeatured,
      customizations: item.customizations,
      selectedVariant: item.selectedVariant,
      quantity: item.quantity,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.cart = user.cart.filter(
      item => item.productId.toString() !== productId
    );

    await user.save();

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNewArrival isFeatured'
    });

    const cartItems = updatedUser.cart.map(item => ({
      _id: item.productId._id,
      productId: item.productId._id,
      title: item.productId.title,
      price: item.customPrice !== undefined ? item.customPrice : item.productId.price,
      images: item.productId.images,
      discount: item.productId.discount,
      category: item.productId.category,
      description: item.productId.description,
      careInstructions: item.productId.careInstructions,
      isNewArrival: item.productId.isNewArrival,
      isFeatured: item.productId.isFeatured,
      customizations: item.customizations,
      selectedVariant: item.selectedVariant,
      quantity: item.quantity,
      addedAt: item.addedAt
    }));

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Clear user's cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.cart = [];
    await user.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cart: [],
      itemCount: 0
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
}; 