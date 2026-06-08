const User = require('../models/User');
const Product = require('../models/Product');
const AddonProduct = require('../models/AddonProduct');
const { logActivity } = require('../utils/activityLogger');

const mapCartItems = (userWithCart) =>
  userWithCart.cart
    .filter(item => item.productId)
    .map(item => {
      const isAddon = item.productModel === 'AddonProduct';
      const prod = item.productId;
      
      let price = item.customPrice !== undefined ? item.customPrice : prod.price;
      let originalPrice = item.customPrice !== undefined ? item.customPrice : prod.price;
      let discount = prod.discount || 0;
      
      if (isAddon) {
        const hasDiscount = prod.discountedPrice && prod.discountedPrice > 0 && prod.discountedPrice < prod.price;
        price = hasDiscount ? prod.discountedPrice : prod.price;
        originalPrice = prod.price;
        discount = hasDiscount ? Math.round(((prod.price - prod.discountedPrice) / prod.price) * 100) : 0;
      } else {
        if (prod.discount > 0) {
          originalPrice = Math.round(prod.price / (1 - prod.discount / 100));
        }
      }

      return {
        _id: item._id,
        productId: prod._id,
        productModel: item.productModel || 'Product',
        title: prod.title || prod.name,
        price: price,
        originalPrice: originalPrice,
        images: prod.images || (prod.image ? [prod.image] : []),
        discount: discount,
        category: prod.category,
        description: prod.description,
        careInstructions: prod.careInstructions || [],
        isNewArrival: Boolean(
          typeof prod.isNew === 'boolean'
            ? prod.isNew
            : prod.isNewArrival
        ),
        isFeatured: prod.isFeatured,
        customizations: item.customizations,
        selectedVariant: item.selectedVariant,
        quantity: item.quantity,
        addedAt: item.addedAt
      };
    });

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title name price discountedPrice images image discount category description careInstructions isNew isNewArrival isFeatured'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Transform cart items to include product details
    const cartItems = mapCartItems(user);

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
    const { productId, quantity = 1, customizations, customPrice, selectedVariant, productModel = 'Product' } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Validate product exists and is not hidden
    let product;
    if (productModel === 'AddonProduct') {
      product = await AddonProduct.findById(productId);
    } else {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (productModel !== 'AddonProduct' && product.hidden) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if item already exists in cart (same productId, productModel, customizations, and selectedVariant)
    const existingItemIndex = user.cart.findIndex(
      item => item.productId.toString() === productId && 
              (item.productModel || 'Product') === productModel &&
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
        productModel,
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
      select: 'title name price discountedPrice images image discount category description careInstructions isNew isNewArrival isFeatured'
    });

    const cartItems = mapCartItems(updatedUser);

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });

    await logActivity({
      req,
      actionType: 'Add to Cart',
      method: 'POST',
      status: 'Success',
      metadata: {
        productId,
        quantity,
      },
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

    // Prefer cart line item id; fallback to product id for backward compatibility.
    let itemIndex = user.cart.findIndex(item => item._id.toString() === productId);

    if (itemIndex === -1) {
      itemIndex = user.cart.findIndex(item => item.productId.toString() === productId);
    }

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    user.cart[itemIndex].quantity = quantity;
    await user.save();

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNew isNewArrival isFeatured'
    });

    const cartItems = mapCartItems(updatedUser);

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });

    await logActivity({
      req,
      actionType: 'Add to Cart',
      method: 'PUT',
      status: 'Success',
      metadata: {
        target: 'cart-item',
        itemId: productId,
        quantity,
      },
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

    // Prefer removing by cart line item id; fallback to removing by product id.
    const hasLineItemId = user.cart.some(item => item._id.toString() === productId);

    if (hasLineItemId) {
      user.cart = user.cart.filter(item => item._id.toString() !== productId);
    } else {
      user.cart = user.cart.filter(item => item.productId.toString() !== productId);
    }

    await user.save();

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNew isNewArrival isFeatured'
    });

    const cartItems = mapCartItems(updatedUser);

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      cart: cartItems,
      itemCount: cartItems.length
    });

    await logActivity({
      req,
      actionType: 'Remove from Cart',
      method: 'DELETE',
      status: 'Success',
      metadata: {
        itemId: productId,
      },
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

    await logActivity({
      req,
      actionType: 'Remove from Cart',
      method: 'DELETE',
      status: 'Success',
      metadata: {
        clearedAll: true,
      },
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
