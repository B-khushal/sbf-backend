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
        title: (item.customizations && item.customizations.title) || prod.title || prod.name,
        price: price,
        originalPrice: originalPrice,
        images: (item.customizations && item.customizations.images) || prod.images || (prod.image ? [prod.image] : []),
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
        addedAt: item.addedAt,
        productType: prod.productType || 'regular',
        isValentineProduct: prod.isValentineProduct || false,
        availableDates: prod.availableDates || [],
        dateWiseStock: prod.dateWiseStock || {},
        dateWisePricing: prod.dateWisePricing || {},
        dateWiseOffers: prod.dateWiseOffers || {},
        dateWiseDeliveryCharges: prod.dateWiseDeliveryCharges || {},
        personalizationEnabled: prod.personalizationEnabled,
        personalizationType: prod.personalizationType,
        fieldLabel: prod.fieldLabel,
        placeholder: prod.placeholder,
        minCharacters: prod.minCharacters,
        maxCharacters: prod.maxCharacters,
        allowedCharacters: prod.allowedCharacters,
        personalizationRequired: prod.personalizationRequired,
        textTransform: prod.textTransform,
        helperText: prod.helperText,
        pricePerCharacter: prod.pricePerCharacter,
        baseIncludedCharacters: prod.baseIncludedCharacters,
        maxExtraPrice: prod.maxExtraPrice,
        sameDay: prod.sameDay !== undefined ? prod.sameDay : true,
      };
    });

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title name price discountedPrice images image discount category description careInstructions isNew isNewArrival isFeatured productType isValentineProduct availableDates dateWiseStock dateWisePricing dateWiseOffers dateWiseDeliveryCharges personalizationEnabled personalizationType fieldLabel placeholder minCharacters maxCharacters allowedCharacters personalizationRequired textTransform helperText pricePerCharacter baseIncludedCharacters maxExtraPrice sameDay'
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

    // Check if item already exists in cart (same productId, productModel, customizations, and selectedVariant)
    const existingItemIndex = user.cart.findIndex(
      item => item.productId.toString() === resolvedProductId.toString() && 
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

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title name price discountedPrice images image discount category description careInstructions isNew isNewArrival isFeatured productType isValentineProduct availableDates dateWiseStock dateWisePricing dateWiseOffers dateWiseDeliveryCharges personalizationEnabled personalizationType fieldLabel placeholder minCharacters maxCharacters allowedCharacters personalizationRequired textTransform helperText pricePerCharacter baseIncludedCharacters maxExtraPrice sameDay'
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
    const { quantity, customizations, customPrice } = req.body;

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

    // Return updated cart
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'cart.productId',
      select: 'title price images discount category description careInstructions isNew isNewArrival isFeatured productType isValentineProduct availableDates dateWiseStock dateWisePricing dateWiseOffers dateWiseDeliveryCharges personalizationEnabled personalizationType fieldLabel placeholder minCharacters maxCharacters allowedCharacters personalizationRequired textTransform helperText pricePerCharacter baseIncludedCharacters maxExtraPrice sameDay'
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
      select: 'title price images discount category description careInstructions isNew isNewArrival isFeatured productType isValentineProduct availableDates dateWiseStock dateWisePricing dateWiseOffers dateWiseDeliveryCharges personalizationEnabled personalizationType fieldLabel placeholder minCharacters maxCharacters allowedCharacters personalizationRequired textTransform helperText pricePerCharacter baseIncludedCharacters maxExtraPrice sameDay'
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
