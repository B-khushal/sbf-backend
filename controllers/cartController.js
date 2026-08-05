const User = require('../models/User');
const Product = require('../models/Product');
const AddonProduct = require('../models/AddonProduct');
const { logActivity } = require('../utils/activityLogger');

const mapCartItemsAsync = async (userWithCart) => {
  const rawCart = Array.isArray(userWithCart.cart) ? userWithCart.cart : [];
  const results = [];

  for (const item of rawCart) {
    if (!item || !item.productId) continue;
    const isAddon = item.productModel === 'AddonProduct';
    
    let prod = item.productId;
    if (typeof prod === 'string' || typeof prod === 'number') {
      if (isAddon) {
        prod = await AddonProduct.findById(item.productId);
      } else {
        prod = await Product.findById(item.productId);
      }
    }

    if (!prod) continue;

    let price = item.customPrice !== undefined ? item.customPrice : (prod.price || 0);
    let originalPrice = item.customPrice !== undefined ? item.customPrice : (prod.price || 0);
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

    results.push({
      _id: item._id || item.id || prod._id,
      id: item._id || item.id || prod._id,
      productId: prod._id || prod.id,
      productModel: item.productModel || 'Product',
      title: (item.customizations && item.customizations.title) || prod.title || prod.name || 'Product',
      name: (item.customizations && item.customizations.title) || prod.title || prod.name || 'Product',
      price: price,
      originalPrice: originalPrice,
      images: (item.customizations && item.customizations.images) || prod.images || (prod.image ? [prod.image] : []),
      discount: discount,
      category: prod.category || '',
      description: prod.description || '',
      careInstructions: prod.careInstructions || [],
      isNewArrival: Boolean(typeof prod.isNew === 'boolean' ? prod.isNew : prod.isNewArrival),
      isFeatured: Boolean(prod.isFeatured),
      customizations: item.customizations,
      selectedVariant: item.selectedVariant,
      quantity: item.quantity || 1,
      addedAt: item.addedAt || new Date(),
      productType: prod.productType || 'regular',
      isValentineProduct: Boolean(prod.isValentineProduct),
      sameDay: prod.sameDay !== undefined ? prod.sameDay : true,
    });
  }

  return results;
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const cartItems = await mapCartItemsAsync(user);

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

const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, customizations, customPrice, selectedVariant, productModel = 'Product' } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    let resolvedProductId = productId;
    
    if (typeof productId === 'string' && productId.startsWith('valentine-gift-')) {
      // Find or create the template product
      let templateProduct = await Product.findOne({ title: 'Custom Valentine Gift Box' });
      if (!templateProduct) {
        const adminUser = await User.findOne({ role: 'admin' });
        const ownerId = adminUser ? adminUser._id : req.user._id;
        templateProduct = await Product.create({
          user: ownerId,
          title: 'Custom Valentine Gift Box',
          price: 0,
          category: 'Valentine',
          description: 'Custom Valentine Gift Box containing selected items',
          images: ['/images/valentine-gift-box.jpg'],
          productType: 'valentine',
          isValentineProduct: true,
          hidden: true,
          countInStock: 99999
        });
      }
      resolvedProductId = templateProduct._id;
    }

    // Validate product exists and is not hidden
    let product;
    if (productModel === 'AddonProduct') {
      product = await AddonProduct.findById(resolvedProductId);
    } else {
      product = await Product.findById(resolvedProductId);
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (productModel !== 'AddonProduct' && product.hidden && product.title !== 'Custom Valentine Gift Box') {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check mixed cart conflicts (prevent regular and valentine products together)
    let cartHasValentine = false;
    let cartHasRegular = false;
    for (const item of user.cart) {
      if (item.productId) {
        let cartProd;
        if (item.productModel === 'AddonProduct') {
          cartProd = await AddonProduct.findById(item.productId);
        } else {
          cartProd = await Product.findById(item.productId);
        }
        if (cartProd) {
          if (cartProd.productType === 'valentine' || cartProd.isValentineProduct) {
            cartHasValentine = true;
          } else {
            cartHasRegular = true;
          }
        }
      }
    }

    const isIncomingValentine = product.productType === 'valentine' || product.isValentineProduct;
    if ((isIncomingValentine && cartHasRegular) || (!isIncomingValentine && cartHasValentine)) {
      return res.status(400).json({
        success: false,
        code: 'MIXED_CART_CONFLICT',
        message: "Valentine Special products and Regular products cannot be checked out together because they follow different delivery schedules."
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = user.cart.findIndex(
      item => String(item.productId) === String(resolvedProductId) && 
              (item.productModel || 'Product') === productModel &&
              JSON.stringify(item.customizations) === JSON.stringify(customizations) &&
              JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
    );

    if (existingItemIndex > -1) {
      user.cart[existingItemIndex].quantity += quantity;
    } else {
      user.cart.push({
        productId: resolvedProductId,
        productModel,
        quantity,
        addedAt: new Date(),
        customizations: customizations,
        customPrice: customPrice,
        selectedVariant: selectedVariant
      });
    }

    await user.save();

    const updatedUser = await User.findById(req.user._id);
    const cartItems = await mapCartItemsAsync(updatedUser);

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
    const { quantity, customizations, customPrice } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let itemIndex = user.cart.findIndex(item => String(item._id || item.id) === productId);
    if (itemIndex === -1) {
      itemIndex = user.cart.findIndex(item => String(item.productId) === productId);
    }

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    if (quantity !== undefined) {
      if (quantity < 1) {
        return res.status(400).json({ message: 'Valid quantity is required' });
      }
      user.cart[itemIndex].quantity = quantity;
    }
    
    if (customizations !== undefined) {
      user.cart[itemIndex].customizations = customizations;
    }
    
    if (customPrice !== undefined) {
      user.cart[itemIndex].customPrice = customPrice;
    }
    
    await user.save();

    const updatedUser = await User.findById(req.user._id);
    const cartItems = await mapCartItemsAsync(updatedUser);

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

    const hasLineItemId = user.cart.some(item => String(item._id || item.id) === productId);

    if (hasLineItemId) {
      user.cart = user.cart.filter(item => String(item._id || item.id) !== productId);
    } else {
      user.cart = user.cart.filter(item => String(item.productId) !== productId);
    }

    await user.save();

    const updatedUser = await User.findById(req.user._id);
    const cartItems = await mapCartItemsAsync(updatedUser);

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
  clearCart,
  mapCartItemsAsync
}; 
