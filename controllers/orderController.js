const Order = require('../models/Order');
const Product = require('../models/Product');
const AddonProduct = require('../models/AddonProduct');
const User = require('../models/User');
const moment = require('moment'); // Import moment.js for date formatting
const { createOrder: createRazorpayOrder, verifyPayment, RAZORPAY_KEY_ID } = require('../services/razorpayService');
const Notification = require('../models/Notification');
const { admin } = require('../middleware/authMiddleware');
const { createOrderNotification } = require('./notificationController');
const { sendEmailNotification, sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');
const { sendOrderNotificationToAdmins, sendToAllAdmins } = require('../services/fcmService');
const { logActivity } = require('../utils/activityLogger');
const { calculateDeliveryFee } = require('../services/deliveryService');
const Offer = require('../models/Offer');

// Helper to increment offer conversion if order has promo code
const trackPromoCodeConversion = async (promoCodeObj) => {
  try {
    if (!promoCodeObj || !promoCodeObj.code) return;
    const promoCode = promoCodeObj.code.trim().toUpperCase();
    
    const currentDate = new Date();
    // Find active offer with matching coupon code
    const offer = await Offer.findOne({
      isActive: true,
      code: promoCode,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    if (offer) {
      offer.conversions = (offer.conversions || 0) + 1;
      await offer.save();
      console.log(`🎉 Campaign conversion tracked for offer: ${offer.title} (ID: ${offer._id})`);
    } else {
      // Check if it's an A/B test variant
      const offerWithVariant = await Offer.findOne({
        isActive: true,
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
        'variants.code': promoCode
      });

      if (offerWithVariant) {
        // Find which variant matches
        const variant = offerWithVariant.variants.find(v => v.code === promoCode);
        if (variant) {
          variant.conversions = (variant.conversions || 0) + 1;
          offerWithVariant.conversions = (offerWithVariant.conversions || 0) + 1;
          await offerWithVariant.save();
          console.log(`🎉 Variant campaign conversion tracked for offer: ${offerWithVariant.title}, variant: ${variant.title}`);
        }
      }
    }
  } catch (error) {
    console.error('Error tracking promo code conversion:', error);
  }
};


// Helper function to recursively flatten arrays and extract strings
const flattenToStrings = (value) => {
  if (typeof value === 'string') {
    // If it looks like a JSON array, try to parse it
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        return flattenToStrings(parsed);
      } catch (e) {
        return [value]; // Return as string if parse fails
      }
    }
    return [value];
  }

  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) {
      result.push(...flattenToStrings(item));
    }
    return result;
  }

  // For any other type, convert to string
  return [String(value)];
};

// Helper function to clean product data before saving
const cleanProductData = (product) => {
  try {
    // Fix details field if it's malformed
    if (product.details) {
      if (Array.isArray(product.details)) {
        const cleanedDetails = [];
        for (let detail of product.details) {
          try {
            const flattened = flattenToStrings(detail);
            cleanedDetails.push(...flattened.filter(item => item && item.trim()));
          } catch (detailError) {
            console.warn(`⚠️  Could not clean detail: ${detail}`, detailError);
            // Skip this detail if it can't be cleaned
          }
        }
        product.details = cleanedDetails;
      } else if (typeof product.details === 'string') {
        // If details is a string instead of array, try to parse it
        try {
          const flattened = flattenToStrings(product.details);
          product.details = flattened.filter(item => item && item.trim());
        } catch (stringDetailError) {
          console.warn(`⚠️  Could not clean string details for ${product.title}`, stringDetailError);
          product.details = []; // Reset to empty array if cleaning fails
        }
      } else {
        // Reset to empty array if details is neither array nor string
        product.details = [];
      }
    }

    // Fix careInstructions field if it's malformed
    if (product.careInstructions) {
      if (Array.isArray(product.careInstructions)) {
        const cleanedInstructions = [];
        for (let instruction of product.careInstructions) {
          try {
            const flattened = flattenToStrings(instruction);
            cleanedInstructions.push(...flattened.filter(item => item && item.trim()));
          } catch (instructionError) {
            console.warn(`⚠️  Could not clean care instruction: ${instruction}`, instructionError);
            // Skip this instruction if it can't be cleaned
          }
        }
        product.careInstructions = cleanedInstructions;
      } else if (typeof product.careInstructions === 'string') {
        // If careInstructions is a string instead of array, try to parse it
        try {
          const flattened = flattenToStrings(product.careInstructions);
          product.careInstructions = flattened.filter(item => item && item.trim());
        } catch (stringInstructionError) {
          console.warn(`⚠️  Could not clean string care instructions for ${product.title}`, stringInstructionError);
          product.careInstructions = []; // Reset to empty array if cleaning fails
        }
      } else {
        // Reset to empty array if careInstructions is neither array nor string
        product.careInstructions = [];
      }
    }

    console.log(`🧹 Cleaned product data for ${product.title}:`, {
      details: product.details?.length || 0,
      careInstructions: product.careInstructions?.length || 0
    });

    return product;
  } catch (overallError) {
    console.error(`❌ Error in cleanProductData for ${product.title}:`, overallError);
    // Reset both fields to empty arrays if overall cleaning fails
    product.details = [];
    product.careInstructions = [];
    return product;
  }
};

const resolveGiftBuilderProductIds = async (items, requestingUserId) => {
  if (!items || !Array.isArray(items)) return items;
  
  let templateProduct = null;
  const User = require('../models/User');
  const Product = require('../models/Product');
  
  for (let i = 0; i < items.length; i++) {
    const productId = items[i].product || items[i].productId;
    if (typeof productId === 'string' && productId.startsWith('valentine-gift-')) {
      if (!templateProduct) {
        templateProduct = await Product.findOne({ title: 'Custom Valentine Gift Box' });
        if (!templateProduct) {
          const adminUser = await User.findOne({ role: 'admin' });
          const ownerId = adminUser ? adminUser._id : (requestingUserId || null);
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
      }
      if (items[i].product) items[i].product = templateProduct._id;
      if (items[i].productId) items[i].productId = templateProduct._id;
    }
  }
  return items;
};

const validateOrderValentineRules = async (items, shippingDetails) => {
  const ValentineSettings = require('../models/ValentineSettings');
  const Product = require('../models/Product');
  const settings = await ValentineSettings.findOne();
  const isValentineEnabled = settings ? settings.enabled : false;

  let hasValentine = false;
  let hasRegular = false;

  const deliveryDate = shippingDetails && shippingDetails.deliveryDate ? new Date(shippingDetails.deliveryDate) : null;

  for (const item of items) {
    const productId = item.product || item.productId;
    if (!productId) continue;
    const prod = await Product.findById(productId);
    if (!prod) continue;

    const isVal = prod.productType === 'valentine' || prod.isValentineProduct;
    if (isVal) {
      hasValentine = true;
    } else {
      hasRegular = true;
    }

    if (isVal) {
      // Valentine product checks
      if (!isValentineEnabled) {
        throw new Error("Valentine Special products are not available currently.");
      }

      if (!deliveryDate) {
        throw new Error("Delivery date is required for Valentine Special products.");
      }

      // Check if delivery date is within Valentine Week (8 Feb - 15 Feb)
      const dMonth = deliveryDate.getMonth(); // 1 = Feb
      const dDate = deliveryDate.getDate();
      const isValentineWeek = (dMonth === 1 && dDate >= 8 && dDate <= 15);

      if (!isValentineWeek) {
        throw new Error("Valentine Special products can only be delivered during Valentine's Week (8 Feb - 15 Feb).");
      }

      // Check if selected date is allowed for this product
      const dayStr = `${dDate} Feb`;
      const fullDayStr = `${dDate} February`;
      
      const isDateAllowed = prod.availableDates.some(availDate => {
        const cleanAvail = availDate.trim().toLowerCase();
        return cleanAvail === dayStr.toLowerCase() || 
               cleanAvail === fullDayStr.toLowerCase() || 
               cleanAvail.includes(String(dDate));
      });

      if (!isDateAllowed && prod.availableDates && prod.availableDates.length > 0) {
        throw new Error(`Product "${prod.title || prod.name}" is not available for delivery on ${dayStr}.`);
      }

      // Check date-wise inventory
      if (prod.dateWiseStock && typeof prod.dateWiseStock.get === 'function') {
        const stockForDate = prod.dateWiseStock.get(dayStr) ?? prod.dateWiseStock.get(fullDayStr);
        if (stockForDate !== undefined && stockForDate <= 0) {
          throw new Error(`Sold Out For Selected Date`);
        }
      }

      // Check date-wise pricing
      if (prod.dateWisePricing && typeof prod.dateWisePricing.get === 'function') {
        const priceForDate = prod.dateWisePricing.get(dayStr) ?? prod.dateWisePricing.get(fullDayStr);
        if (priceForDate !== undefined) {
          const expectedPrice = priceForDate;
          const itemPrice = item.finalPrice || item.price;
          if (Math.abs(itemPrice - expectedPrice) > 5) {
            throw new Error(`Pricing mismatch for "${prod.title || prod.name}" on ${dayStr}. Expected ₹${expectedPrice}, got ₹${itemPrice}.`);
          }
        }
      }
    } else {
      // Regular product checks
      if (deliveryDate) {
        const dMonth = deliveryDate.getMonth(); // 1 = Feb
        const dDate = deliveryDate.getDate();
        const isValentineWeek = (dMonth === 1 && dDate >= 8 && dDate <= 15);
        if (isValentineWeek) {
          throw new Error("Valentine Week delivery dates are reserved exclusively for Valentine's Special products.");
        }
      }
    }
  }

  // Prevent mixed carts
  if (hasValentine && hasRegular) {
    throw new Error("Valentine Special products and Regular products cannot be checked out together because they follow different delivery schedules.");
  }
};


// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    // Debug logs
    console.log('User from request:', req.user);
    console.log('Received order data:', JSON.stringify(req.body, null, 2));

    const { shippingDetails, items, paymentDetails, totalAmount, giftDetails, currency, currencyRate, originalCurrency } = req.body;

    // Resolve any client-side valentine-gift- IDs
    await resolveGiftBuilderProductIds(items, req.user?._id);

    // Validate required data
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain items'
      });
    }

    // Valentine validations
    try {
      await validateOrderValentineRules(items, shippingDetails);
    } catch (valError) {
      return res.status(400).json({
        success: false,
        message: valError.message
      });
    }

    const userId = req.user?._id || null;
    if (!userId && (!shippingDetails?.email || !shippingDetails?.phone)) {
      return res.status(400).json({
        success: false,
        message: 'Email and phone number are required for guest checkout'
      });
    }

    // Generate order number in YYMM-XXX-DD format
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // Find the last order for the current year and month
    const lastOrder = await Order.findOne({
      orderNumber: new RegExp(`^${year}${month}`)
    }, {}, { sort: { 'orderNumber': -1 } });

    let sequence = '001';
    if (lastOrder) {
      // Extract the sequence number from the last order (positions 4-6 in YYMMDDDDD format)
      const lastSequence = parseInt(lastOrder.orderNumber.substring(4, 7));
      sequence = (lastSequence + 1).toString().padStart(3, '0');
    }

    const orderNumber = `${year}${month}${sequence}${day}`;

    // Server-side calculation and validation
    const subtotalCalculated = items.reduce((sum, item) => sum + (item.finalPrice || item.price) * item.quantity, 0);

    // Enforce same-day delivery IST cutoff validation
    if (shippingDetails && shippingDetails.deliveryDate) {
      const deliveryDateMoment = moment(shippingDetails.deliveryDate).utcOffset('+05:30').startOf('day');
      const currentIST = moment().utcOffset('+05:30');
      const currentISTStartOfToday = moment().utcOffset('+05:30').startOf('day');

      if (deliveryDateMoment.isBefore(currentISTStartOfToday, 'day')) {
        return res.status(400).json({
          success: false,
          message: 'Delivery date cannot be in the past.'
        });
      }

      if (deliveryDateMoment.isSame(currentISTStartOfToday, 'day')) {
        if (currentIST.hour() >= 18) {
          return res.status(400).json({
            success: false,
            message: 'Same-day delivery is available only for orders placed before 6:00 PM. Please select the next available delivery date.'
          });
        }
      }
    }

    const deliveryChargeResult = await calculateDeliveryFee({
      subtotal: subtotalCalculated,
      timeSlot: shippingDetails.timeSlot,
      userId,
      email: shippingDetails.email,
      phone: shippingDetails.phone
    });
    const deliveryChargeCalculated = deliveryChargeResult.deliveryCharge;
    const isFirstOrderFreeDelivery = deliveryChargeResult.isFirstOrderFreeDelivery;

    // Validate subtotal if sent
    if (req.body.subtotal !== undefined && Math.abs(req.body.subtotal - subtotalCalculated) > 1) {
      return res.status(400).json({
        success: false,
        message: `Invalid subtotal. Expected ${subtotalCalculated}, got ${req.body.subtotal}`
      });
    }

    // Validate delivery charge if sent
    if (req.body.deliveryCharge !== undefined && Math.abs(req.body.deliveryCharge - deliveryChargeCalculated) > 1) {
      return res.status(400).json({
        success: false,
        message: `Invalid delivery charge. Expected ${deliveryChargeCalculated}, got ${req.body.deliveryCharge}`
      });
    }

    // Discount from request or derived from totalAmount formula
    const discount = req.body.discount !== undefined
      ? req.body.discount
      : Math.max(0, subtotalCalculated + deliveryChargeCalculated - totalAmount);

    const finalTotal = subtotalCalculated + deliveryChargeCalculated - discount;

    if (Math.abs(totalAmount - finalTotal) > 1) {
      return res.status(400).json({
        success: false,
        message: `Total amount mismatch. Calculated ${finalTotal}, got ${totalAmount}`
      });
    }

    // Create the order object with all required fields
    const orderData = {
      orderNumber,
      user: userId,
      shippingDetails: {
        fullName: shippingDetails.fullName,
        email: shippingDetails.email,
        phone: shippingDetails.phone,
        address: shippingDetails.address,
        apartment: shippingDetails.apartment || '',
        city: shippingDetails.city,
        state: shippingDetails.state,
        zipCode: shippingDetails.zipCode,
        notes: shippingDetails.notes || '',
        cardMessage: shippingDetails.cardMessage || '',
        deliverySpecialInstructions: shippingDetails.deliverySpecialInstructions || '',
        deliveryDate: shippingDetails.deliveryDate,
        timeSlot: shippingDetails.timeSlot
      },
      items: items.map(item => ({
        product: item.product || item.productId,
        productModel: item.productModel || 'Product',
        title: item.title || '',
        image: item.image || item.images?.[0] || '',
        images: Array.isArray(item.images) ? item.images : [],
        selectedVariant: item.selectedVariant || null,
        quantity: item.quantity,
        price: item.price,
        finalPrice: item.finalPrice || item.price,
        customizations: item.customizations || null,
        characterCount: item.characterCount || item.customizations?.personalization?.characterCount || 0
      })),
      paymentDetails: {
        method: paymentDetails.method,
        razorpayOrderId: paymentDetails.razorpayOrderId,
        razorpayPaymentId: paymentDetails.razorpayPaymentId,
        razorpaySignature: paymentDetails.razorpaySignature
      },
      totalAmount: finalTotal,
      subtotal: subtotalCalculated,
      deliveryCharge: deliveryChargeCalculated,
      discount,
      finalTotal,
      isFirstOrderFreeDelivery,
      currency: currency || 'INR',
      currencyRate: currencyRate || 1,
      originalCurrency: originalCurrency || currency || 'INR',
      status: 'order_placed',
      promoCode: req.body.promoCode || undefined
    };

    // Add gift details if present
    if (giftDetails) {
      orderData.giftDetails = giftDetails;
    }

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const order = new Order(orderData);
    const savedOrder = await order.save();

    // Track campaign conversion if promo code is used
    if (savedOrder.promoCode) {
      await trackPromoCodeConversion(savedOrder.promoCode);
    }

    await logActivity({
      req,
      actionType: 'Checkout',
      method: 'POST',
      status: 'Success',
      userId: userId,
      metadata: {
        orderId: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        totalAmount: savedOrder.totalAmount,
        itemCount: items.length,
      },
    });

    console.log('Order saved successfully:', JSON.stringify(savedOrder, null, 2));

    // Send notifications after order is successfully created
    try {
      // Get customer details (for logged in, fetch from User, for guest, use shippingDetails)
      const customer = userId 
        ? await User.findById(userId)
        : {
            name: savedOrder.shippingDetails.fullName,
            email: savedOrder.shippingDetails.email,
            phone: savedOrder.shippingDetails.phone
          };

      // Populate product details for notifications
      const populatedOrder = await Order.findById(savedOrder._id)
        .populate({
          path: 'items.product',
          select: 'name title price images'
        });

      // Prepare notification data
      const notificationData = {
        order: populatedOrder,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone || populatedOrder.shippingDetails.phone
        },
        items: populatedOrder.items
      };

      // Send email notification (includes both customer and admin emails)
      const emailResult = await sendEmailNotification(notificationData);
      console.log('Email notification result:', emailResult);

      // Create admin notification for real-time updates
      try {
        const adminNotification = await createOrderNotification({
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          customerName: customer.name,
          amount: savedOrder.totalAmount,
          currency: savedOrder.currency || 'INR'
        });
        console.log('✅ Admin notification created successfully for order:', savedOrder.orderNumber);

        // Store in a global variable for real-time polling (optional backup)
        global.latestNotifications = global.latestNotifications || [];
        global.latestNotifications.unshift({
          id: adminNotification.id || `order-${Date.now()}`,
          type: 'order',
          title: '🎉 New Order Received!',
          message: `Order ${savedOrder.orderNumber} placed by ${customer.name}. Amount: ${savedOrder.currency === 'INR' ? '₹' : '$'}${savedOrder.totalAmount}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber
        });

        // Keep only last 50 notifications in memory
        if (global.latestNotifications.length > 50) {
          global.latestNotifications = global.latestNotifications.slice(0, 50);
        }

        console.log('📨 Notification added to global notifications for real-time polling');

      } catch (adminNotificationError) {
        console.error('❌ Error creating admin notification:', adminNotificationError);
      }

      // Send FCM push notification to ALL admin devices immediately when order is placed
      try {
        console.log('🔔 Sending push notification to all admin devices...');
        const fcmResult = await sendToAllAdmins({
          title: '🎉 New Order Received!',
          body: `Order #${savedOrder.orderNumber} - ${savedOrder.currency === 'INR' ? '₹' : '$'}${savedOrder.totalAmount}`,
          orderId: savedOrder._id.toString(),
          orderNumber: savedOrder.orderNumber,
          customerName: customer.name,
          amount: savedOrder.totalAmount.toString(),
          type: 'NEW_ORDER'  // MUST be "NEW_ORDER" for 3x ring + vibration
        });

        if (fcmResult.success) {
          console.log(`✅ Push notification sent to ${fcmResult.sent}/${fcmResult.total} admin devices`);
          if (fcmResult.failed > 0) {
            console.log(`⚠️  ${fcmResult.failed} notification(s) failed`);
          }
        } else {
          console.warn('⚠️  Failed to send push notification:', fcmResult.error);
        }
      } catch (fcmError) {
        console.error('❌ Error sending FCM push notification:', fcmError.message);
        // Don't fail order creation if FCM fails
      }

      // Add notification status to response
      savedOrder.emailNotificationStatus = emailResult;

    } catch (notificationError) {
      console.error('❌ Error sending order notifications:', notificationError);
      // Don't fail the order creation if notifications fail
    }

    // Populate the order with product details before sending to frontend
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate({
        path: 'items.product',
        select: 'name title price images sku discount vendor',
        populate: {
          path: 'vendor',
          select: 'storeName'
        }
      });

    res.status(201).json({
      success: true,
      order: populatedOrder
    });
  } catch (error) {
    console.error('Detailed error creating order:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating order',
      error: error.stack // Remove this in production
    });
  }
};

// Function to get the next order number (useful for previews)
const getNextOrderNumber = async (req, res) => {
  try {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const lastOrder = await Order.findOne({
      orderNumber: new RegExp(`^${year}${month}`)
    }, {}, { sort: { 'orderNumber': -1 } });

    let sequence = '001';
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.substring(4, 7));
      sequence = (lastSequence + 1).toString().padStart(3, '0');
    }

    const nextOrderNumber = `${year}${month}${sequence}${day}`;

    res.json({
      success: true,
      nextOrderNumber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating next order number',
      error: error.message
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'items.product',
        select: 'title price images sku discount vendor',
        populate: {
          path: 'vendor',
          select: 'storeName'
        }
      })
      .populate('user', 'name email');

    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.payer.email_address,
      };

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = async (req, res) => {
  try {
    console.log(`[Order Controller] 🚚 updateOrderToDelivered status update request received for order ID: ${req.params.id}`);

    const order = await Order.findById(req.params.id).populate({
      path: 'items.product',
      select: 'title price images sku discount'
    });

    if (!order) {
      console.log('❌ Order not found:', req.params.id);
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log('📋 Order found:', order.orderNumber, 'Current status:', order.status);
    const previousStatus = order.status;

    // Update order status
    order.isDelivered = true;
    order.deliveredAt = Date.now();
    order.status = 'delivered';

    console.log('🔄 Status change:', previousStatus, '→', order.status);

    // Update stock when order is delivered
    if (!['being_made', 'delivered'].includes(previousStatus) && !order.stockUpdated) {
      console.log('📦 Updating stock for order:', order.orderNumber);

      for (const item of order.items) {
        let product;
        if (item.productModel === 'AddonProduct') {
          product = await AddonProduct.findById(item.product._id);
        } else {
          product = await Product.findById(item.product._id);
        }
        if (product) {
          if (item.productModel === 'AddonProduct') {
            if (product.stock >= item.quantity) {
              product.stock -= item.quantity;
              await product.save({ validateBeforeSave: false });
              console.log(`✅ Updated stock for addon product ${product.title || product.name}: ${product.stock + item.quantity} -> ${product.stock}`);
            } else {
              console.log(`Warning: Insufficient stock for addon product ${product.title || product.name}. Available: ${product.stock}, Required: ${item.quantity}`);
              return res.status(400).json({
                message: `Insufficient stock for addon product ${product.title || product.name}. Available: ${product.stock}, Required: ${item.quantity}`
              });
            }
          } else {
            const requiredStock = (product.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
              ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
              : item.quantity;

            if (product.countInStock >= requiredStock) {
              product.countInStock -= requiredStock;

              if (product.productType === 'valentine' || product.isValentineProduct) {
                const d = new Date(order.shippingDetails.deliveryDate);
                const dayStr = `${d.getDate()} Feb`;
                const fullDayStr = `${d.getDate()} February`;
                let keyToUse = null;
                if (product.dateWiseStock && typeof product.dateWiseStock.has === 'function') {
                  if (product.dateWiseStock.has(dayStr)) keyToUse = dayStr;
                  else if (product.dateWiseStock.has(fullDayStr)) keyToUse = fullDayStr;
                  if (keyToUse) {
                    const currentStock = product.dateWiseStock.get(keyToUse);
                    product.dateWiseStock.set(keyToUse, Math.max(0, currentStock - item.quantity));
                  }
                }
              }

              try {
                // Clean product data before saving to prevent casting errors
                cleanProductData(product);
                await product.save();
                console.log(`✅ Updated stock for product ${product.title}: ${product.countInStock + requiredStock} -> ${product.countInStock}`);
              } catch (productSaveError) {
                console.error(`❌ Error saving product ${product.title}:`, productSaveError);

                // Try to save without cleaning if the cleaning failed
                try {
                  // Reset any changes and just update the stock
                  const freshProduct = await Product.findById(item.product._id);
                  const freshRequiredStock = (freshProduct && freshProduct.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
                    ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
                    : item.quantity;

                  if (freshProduct && freshProduct.countInStock >= freshRequiredStock) {
                    freshProduct.countInStock -= freshRequiredStock;
                    // Force save without validation for malformed data
                    await freshProduct.save({ validateBeforeSave: false });
                    console.log(`⚠️  Force-updated stock for product ${freshProduct.title} (bypassed validation)`);
                  } else {
                    console.error(`❌ Could not force-update stock for product ${product.title}`);
                  }
                } catch (forceSaveError) {
                  console.error(`❌ Force save also failed for product ${product.title}:`, forceSaveError);
                }
              }
            } else {
              console.log(`Warning: Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${requiredStock}`);
              return res.status(400).json({
                message: `Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${requiredStock}`
              });
            }
          }
        }
      }

      // Mark stock as updated
      order.stockUpdated = true;
    } else {
      console.log('📦 Stock already updated or status already processed');
    }

    const updatedOrder = await order.save();
    console.log('💾 Order saved successfully');

    // Send delivery confirmation email with invoice when order is delivered
    if (previousStatus !== 'delivered') {
      console.log('🚚 Order delivered, sending delivery confirmation email with invoice...');
      console.log('📧 Previous status:', previousStatus, 'New status:', order.status);

      // Create delivery notification for admin
      try {
        const { createAdminNotification } = require('./notificationController');
        await createAdminNotification({
          type: 'info',
          title: '🚚 Order Delivered!',
          message: `Order ${order.orderNumber} has been successfully delivered to ${order.shippingDetails?.fullName || 'customer'}.`,
          metadata: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.shippingDetails?.fullName,
            deliveredAt: new Date().toISOString()
          }
        });
        console.log('✅ Delivery notification created for admin:', order.orderNumber);
      } catch (notificationError) {
        console.error('❌ Error creating delivery notification:', notificationError);
      }

      try {
        // Get customer details
        const User = require('../models/User');
        const customer = await User.findById(order.user);

        console.log('👤 Customer lookup result:', customer ? 'Found' : 'Not found');
        console.log('📧 Customer email:', customer?.email);

        if (customer && customer.email) {
          // Populate product details for delivery email
          const populatedOrder = await Order.findById(order._id)
            .populate({
              path: 'items.product',
              select: 'name title price images sku discount'
            });

          // Prepare delivery notification data
          const deliveryNotificationData = {
            order: populatedOrder,
            customer: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone || order.shippingDetails.phone
            },
            items: populatedOrder.items
          };

          console.log(`[Order Controller] 👤 Customer details resolved: Name="${customer.name}", Email="${customer.email}"`);
          console.log(`[Order Controller] 📤 Triggering sendDeliveryConfirmationWithInvoice for order #${order.orderNumber}`);

          // Send delivery confirmation email with invoice
          const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');
          const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);

          console.log(`[Order Controller] 📧 sendDeliveryConfirmationWithInvoice output for order #${order.orderNumber}:`, emailResult);

          if (emailResult.success) {
            console.log(`[Order Controller] ✅ Delivery confirmation email with invoice sent successfully to: ${customer.email}`);
          } else {
            console.error(`[Order Controller] ❌ Failed to send delivery confirmation email:`, emailResult.error);
          }
        } else {
          console.warn('⚠️  No customer email found for delivery confirmation');
          console.warn('Customer object:', customer);
        }
      } catch (deliveryEmailError) {
        console.error('❌ Error sending delivery confirmation email:', deliveryEmailError);
        console.error('Error stack:', deliveryEmailError.stack);
        // Don't fail the order status update if email fails
      }
    } else {
      console.log('📧 Email not sent - order was already delivered');
    }

    console.log('✅ updateOrderToDelivered completed successfully');
    res.json(updatedOrder);
  } catch (error) {
    console.error('❌ Error in updateOrderToDelivered:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate({
        path: 'items.product',
        select: 'title images price discount vendor',
        populate: {
          path: 'vendor',
          select: 'storeName'
        }
      })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// @desc    Get all orders with filtering options
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20, // Increased default from 10 to 20
      status,
      dateFrom,
      dateTo,
      search,
      deliveryDateFrom,
      deliveryDateTo,
      highlight3Days,
      firstOrderFreeDelivery
    } = req.query;

    // Validate and set limits
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(5, parseInt(limit))); // Allow 5-100 orders per page

    // Build query object
    let query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by first-order free delivery
    if (firstOrderFreeDelivery === 'true') {
      query.isFirstOrderFreeDelivery = true;
    } else if (firstOrderFreeDelivery === 'false') {
      query.isFirstOrderFreeDelivery = false;
    }

    // Filter by order creation date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 1 day to include the end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt.$lt = endDate;
      }
    }

    // Filter by delivery date range
    if (deliveryDateFrom || deliveryDateTo) {
      query['shippingDetails.deliveryDate'] = {};
      if (deliveryDateFrom) {
        query['shippingDetails.deliveryDate'].$gte = new Date(deliveryDateFrom);
      }
      if (deliveryDateTo) {
        const endDate = new Date(deliveryDateTo);
        endDate.setDate(endDate.getDate() + 1);
        query['shippingDetails.deliveryDate'].$lt = endDate;
      }
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { orderNumber: searchRegex },
        { 'shippingDetails.fullName': searchRegex },
        { 'shippingDetails.email': searchRegex },
        { 'shippingDetails.phone': searchRegex },
        { 'shippingDetails.city': searchRegex }
      ];
    }

    console.log('Orders query:', JSON.stringify(query, null, 2));
    console.log(`Pagination: Page ${pageNumber}, Size ${pageSize}`);

    // Get total count for pagination
    const total = await Order.countDocuments(query);
    const totalPages = Math.ceil(total / pageSize);
    const skip = (pageNumber - 1) * pageSize;

    // Fetch orders with pagination
    const orders = await Order.find(query)
      .populate([
        {
          path: 'user',
          select: 'name email'
        },
        {
          path: 'items.product',
          select: 'title images price discount vendor',
          populate: {
            path: 'vendor',
            select: 'storeName'
          }
        }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Add 3-day highlighting information if requested
    let processedOrders = orders;
    if (highlight3Days === 'true') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      processedOrders = orders.map(order => {
        const deliveryDate = order.shippingDetails?.deliveryDate;
        let highlight = null;

        if (deliveryDate) {
          const deliveryDateTime = new Date(deliveryDate);
          const now = new Date();
          const diffInDays = Math.ceil((deliveryDateTime - now) / (1000 * 60 * 60 * 24));

          if (diffInDays <= 3 && diffInDays >= 0) {
            if (diffInDays === 0) {
              highlight = { type: 'today', urgency: 'critical', message: 'Delivery today!' };
            } else if (diffInDays === 1) {
              highlight = { type: 'tomorrow', urgency: 'high', message: 'Delivery tomorrow' };
            } else if (diffInDays <= 3) {
              highlight = { type: 'soon', urgency: 'medium', message: `Delivery in ${diffInDays} days` };
            }
          } else if (diffInDays < 0) {
            highlight = { type: 'overdue', urgency: 'critical', message: 'Delivery overdue!' };
          }
        }

        return {
          ...order.toObject(),
          deliveryHighlight: highlight
        };
      });
    }

    // Calculate pagination info
    const paginationInfo = {
      currentPage: pageNumber,
      pageSize: pageSize,
      totalItems: total,
      totalPages: totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
      nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
      prevPage: pageNumber > 1 ? pageNumber - 1 : null,
      startIndex: skip + 1,
      endIndex: Math.min(skip + pageSize, total),
      remainingItems: Math.max(0, total - (skip + pageSize))
    };

    console.log('Pagination info:', paginationInfo);

    res.json({
      success: true,
      orders: processedOrders,
      pagination: paginationInfo,
      meta: {
        query: {
          status: status || 'all',
          search: search || '',
          dateRange: { from: dateFrom, to: dateTo },
          deliveryDateRange: { from: deliveryDateFrom, to: deliveryDateTo },
          highlight3Days: highlight3Days === 'true'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch orders',
      error: error.message
    });
  }
};

// @desc    Get today's orders for admin workflow
// @route   GET /api/orders/today
// @access  Private/Admin
const getTodayOrders = async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const query = {
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    };

    // Worker-friendly grouping for quick filtering in UI
    if (status === 'pending') {
      query.status = { $in: ['order_placed', 'received', 'being_made', 'out_for_delivery'] };
    } else if (status === 'completed') {
      query.status = 'delivered';
    } else if (status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate([
        {
          path: 'user',
          select: 'name email'
        },
        {
          path: 'items.product',
          select: 'title images price discount vendor',
          populate: {
            path: 'vendor',
            select: 'storeName'
          }
        }
      ])
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      count: orders.length,
      dateRange: {
        from: startOfToday,
        to: endOfToday
      },
      orders
    });
  } catch (error) {
    console.error('Error fetching today\'s orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch today\'s orders',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`[Order Controller] 🔄 updateOrderStatus status update request received for order ID: ${req.params.id}, New status: "${status}"`);
    console.log('📝 Request body:', req.body);

    const order = await Order.findById(req.params.id).populate({
      path: 'items.product',
      select: 'title price images sku discount'
    });

    if (!order) {
      console.log('❌ Order not found:', req.params.id);
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log('📋 Order found:', order.orderNumber, 'Current status:', order.status);
    console.log('👤 Order user ID:', order.user);
    console.log('📧 Shipping details email:', order.shippingDetails?.email);
    console.log('📧 Shipping details name:', order.shippingDetails?.fullName);

    const previousStatus = order.status;
    order.status = status;

    // Send FCM push notification to all admins when order is confirmed (received status)
    if (status === 'received' && previousStatus !== 'received') {
      console.log('🔔 Order confirmed! Sending push notification to all admins...');
      try {
        const notificationResult = await sendToAllAdmins({
          title: '🎉 New Order Received!',
          body: `Order #${order.orderNumber} - ₹${order.totalAmount}`,
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          customerName: order.shippingDetails?.fullName || 'Customer',
          amount: order.totalAmount.toString(),
          type: 'NEW_ORDER'  // MUST be "NEW_ORDER" for 3x ring + vibration
        });

        if (notificationResult.success) {
          console.log(`✅ Push notification sent to ${notificationResult.sent}/${notificationResult.total} devices`);
          if (notificationResult.failed > 0) {
            console.log(`⚠️  ${notificationResult.failed} notification(s) failed`);
          }
        } else {
          console.warn('⚠️  Failed to send push notification:', notificationResult.error);
        }
      } catch (fcmError) {
        console.error('❌ Error sending FCM notification:', fcmError.message);
        // Don\'t fail the order status update if FCM fails
      }
    }

    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      console.log('🚚 Order marked as delivered, setting deliveredAt timestamp');
    }

    console.log('🔄 Status change:', previousStatus, '→', order.status);

    // Update stock when order is confirmed (being_made or delivered)
    if ((status === 'being_made' || status === 'delivered') && !['being_made', 'delivered'].includes(previousStatus) && !order.stockUpdated) {
      console.log('📦 Updating stock for order:', order.orderNumber);

      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          // Check if we have enough stock
          const requiredStock = (product.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
            ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
            : item.quantity;

          if (product.countInStock >= requiredStock) {
            product.countInStock -= requiredStock;

            try {
              // Clean product data before saving to prevent casting errors
              cleanProductData(product);
              await product.save();
              console.log(`✅ Updated stock for product ${product.title}: ${product.countInStock + requiredStock} -> ${product.countInStock}`);
            } catch (productSaveError) {
              console.error(`❌ Error saving product ${product.title}:`, productSaveError);

              // Try to save without cleaning if the cleaning failed
              try {
                // Reset any changes and just update the stock
                const freshProduct = await Product.findById(item.product._id);
                const freshRequiredStock = (freshProduct && freshProduct.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
                  ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
                  : item.quantity;

                if (freshProduct && freshProduct.countInStock >= freshRequiredStock) {
                  freshProduct.countInStock -= freshRequiredStock;
                  // Force save without validation for malformed data
                  await freshProduct.save({ validateBeforeSave: false });
                  console.log(`⚠️  Force-updated stock for product ${freshProduct.title} (bypassed validation)`);
                } else {
                  console.error(`❌ Could not force-update stock for product ${product.title}`);
                }
              } catch (forceSaveError) {
                console.error(`❌ Force save also failed for product ${product.title}:`, forceSaveError);
              }
            }
          } else {
            console.log(`Warning: Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${requiredStock}`);
            return res.status(400).json({
              message: `Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${requiredStock}`
            });
          }
        }
      }

      // Mark stock as updated
      order.stockUpdated = true;

      // Create status change notification for admin based on new status
      try {
        const { createAdminNotification } = require('./notificationController');
        let statusTitle, statusMessage;

        if (status === 'being_made') {
          statusTitle = '👨‍🍳 Order In Production!';
          statusMessage = `Order ${order.orderNumber} is now being prepared for ${order.shippingDetails?.fullName || 'customer'}.`;
        } else if (status === 'delivered') {
          statusTitle = '✅ Order Ready for Delivery!';
          statusMessage = `Order ${order.orderNumber} is ready for delivery to ${order.shippingDetails?.fullName || 'customer'}.`;
        }

        if (statusTitle && statusMessage) {
          await createAdminNotification({
            type: 'info',
            title: statusTitle,
            message: statusMessage,
            metadata: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              customerName: order.shippingDetails?.fullName,
              newStatus: status,
              previousStatus: previousStatus
            }
          });
          console.log(`✅ Status change notification created: ${order.orderNumber} -> ${status}`);
        }
      } catch (notificationError) {
        console.error('Error creating status change notification:', notificationError);
      }

      // Create notification for stock update
      try {
        const notification = new Notification({
          title: 'Stock Updated',
          message: `Stock updated for order ${order.orderNumber}. ${order.items.length} products' stock reduced.`,
          type: 'info',
          read: false
        });
        await notification.save();
      } catch (notificationError) {
        console.error('Error creating stock update notification:', notificationError);
      }
    } else {
      console.log('📦 Stock already updated or status already processed');
    }

    const updatedOrder = await order.save();
    console.log('💾 Order saved successfully');

    // Send delivery confirmation email with invoice when order is delivered
    console.log('🧪 Checking delivery email condition...');
    console.log('  status === "delivered":', status === 'delivered');
    console.log('  previousStatus !== "delivered":', previousStatus !== 'delivered');
    console.log('  previousStatus value:', previousStatus);
    console.log('  Overall condition result:', status === 'delivered' && previousStatus !== 'delivered');

    if (status === 'delivered' && previousStatus !== 'delivered') {
      console.log('🚚 Order delivered, sending delivery confirmation email with invoice...');
      console.log('📧 Previous status:', previousStatus, 'New status:', order.status);

      // Create delivery notification for admin
      try {
        const { createAdminNotification } = require('./notificationController');
        await createAdminNotification({
          type: 'info',
          title: '🚚 Order Delivered!',
          message: `Order ${order.orderNumber} has been successfully delivered to ${order.shippingDetails?.fullName || 'customer'}.`,
          metadata: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            customerName: order.shippingDetails?.fullName,
            deliveredAt: new Date().toISOString()
          }
        });
        console.log('✅ Delivery notification created for admin:', order.orderNumber);
      } catch (notificationError) {
        console.error('Error creating delivery notification:', notificationError);
      }

      try {
        // Get customer details - try User model first, then fallback to shipping details
        const User = require('../models/User');
        let customer = null;
        let customerEmail = null;
        let customerName = null;

        // Try to get customer from User model
        if (order.user) {
          customer = await User.findById(order.user);
          console.log('👤 Customer lookup result:', customer ? 'Found' : 'Not found');
          console.log('📧 Customer email from User model:', customer?.email);

          if (customer && customer.email) {
            customerEmail = customer.email;
            customerName = customer.name;
          }
        }

        // Fallback to shipping details email if User model email not found
        if (!customerEmail && order.shippingDetails && order.shippingDetails.email) {
          customerEmail = order.shippingDetails.email;
          customerName = order.shippingDetails.fullName;
          console.log('📧 Using email from shipping details:', customerEmail);
        }

        if (customerEmail) {
          // Populate product details for delivery email
          const populatedOrder = await Order.findById(order._id)
            .populate({
              path: 'items.product',
              select: 'name title price images sku discount'
            });

          // Prepare delivery notification data
          const deliveryNotificationData = {
            order: populatedOrder,
            customer: {
              name: customerName || order.shippingDetails.fullName,
              email: customerEmail,
              phone: customer?.phone || order.shippingDetails.phone
            },
            items: populatedOrder.items
          };

          console.log(`[Order Controller] 👤 Customer details resolved: Name="${customerName || order.shippingDetails.fullName}", Email="${customerEmail}"`);
          console.log(`[Order Controller] 📤 Triggering sendDeliveryConfirmationWithInvoice for order #${order.orderNumber}`);

          // Send delivery confirmation email with invoice
          const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');
          const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);

          console.log(`[Order Controller] 📧 sendDeliveryConfirmationWithInvoice output for order #${order.orderNumber}:`, emailResult);

          if (emailResult.success) {
            console.log(`[Order Controller] ✅ Delivery confirmation email with invoice sent successfully to: ${customerEmail}`);
          } else {
            console.error(`[Order Controller] ❌ Failed to send delivery confirmation email:`, emailResult.error);
          }
        } else {
          console.warn('⚠️  No customer email found for delivery confirmation');
          console.warn('⚠️  Order user ID:', order.user);
          console.warn('⚠️  Shipping details email:', order.shippingDetails?.email);
        }
      } catch (deliveryEmailError) {
        console.error('❌ Error sending delivery confirmation email:', deliveryEmailError);
        console.error('Error stack:', deliveryEmailError.stack);
        // Don't fail the order status update if email fails
      }
    } else {
      console.log('📧 Email not sent - order was already delivered or status is not delivered');
    }

    // Restore stock if order is cancelled from being_made or delivered status
    if (status === 'cancelled' && ['being_made', 'delivered'].includes(previousStatus) && order.stockUpdated) {
      console.log('Order cancelled from completed status, restoring stock for items:', order.items);

      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          const restoredStock = (product.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
            ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
            : item.quantity;

          product.countInStock += restoredStock;

          try {
            // Clean product data before saving to prevent casting errors
            cleanProductData(product);
            await product.save();
            console.log(`✅ Restored stock for product ${product.title}: ${product.countInStock - restoredStock} -> ${product.countInStock}`);
          } catch (productSaveError) {
            console.error(`❌ Error saving product during stock restoration ${product.title}:`, productSaveError);

            // Try to save without cleaning if the cleaning failed
            try {
              // Reset and try force save
              const freshProduct = await Product.findById(item.product._id);
              if (freshProduct) {
                const freshRestoredStock = (freshProduct.personalizationEnabled && (item.characterCount || item.customization?.personalization?.characterCount))
                  ? (item.characterCount || item.customization?.personalization?.characterCount) * item.quantity
                  : item.quantity;

                freshProduct.countInStock += freshRestoredStock;
                await freshProduct.save({ validateBeforeSave: false });
                console.log(`⚠️  Force-restored stock for product ${freshProduct.title} (bypassed validation)`);
              }
            } catch (forceSaveError) {
              console.error(`❌ Force save also failed for product ${product.title}:`, forceSaveError);
            }
          }
        }
      }
    }

    console.log('✅ updateOrderStatus completed successfully');
    res.json(updatedOrder);
  } catch (error) {
    console.error('❌ Error in updateOrderStatus:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create Razorpay order
// @route   POST /api/orders/create-razorpay-order
// @access  Private
const createRazorpayOrderHandler = async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    const { amount, currency } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    // Amount should already be in paise from frontend
    const amountInPaise = Math.round(parseFloat(amount));

    console.log('Creating Razorpay order with:', { amount: amountInPaise, currency });
    const order = await createRazorpayOrder(amountInPaise, currency);
    console.log('Razorpay order created:', order);

    // Send back the response in the format Razorpay expects
    res.json({
      success: true,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      key: RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Detailed error creating Razorpay order:', error);

    // Check for specific Razorpay errors
    if (error.error) {
      const errorCode = error.error.code;
      const errorDescription = error.error.description || error.error.message;

      console.error('Razorpay API Error:', {
        code: errorCode,
        description: errorDescription,
        details: error.error
      });

      return res.status(400).json({
        success: false,
        message: `Razorpay Error: ${errorDescription}`,
        code: errorCode
      });
    }

    // Generic error handling
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating order',
      error: error.stack
    });
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/orders/verify-payment
// @access  Private
const verifyRazorpayPaymentHandler = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData
    } = req.body;

    console.log('Verifying payment:', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature ? 'present' : 'missing',
      orderData: orderData ? 'present' : 'missing'
    });

    // Verify payment signature
    const isValid = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // If payment is verified and orderData is provided, create the order
    if (orderData) {
      // Resolve any client-side valentine-gift- IDs
      await resolveGiftBuilderProductIds(orderData.items, req.user?._id);

      // Validate required data
      if (!orderData.items || orderData.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order must contain items'
        });
      }

      // Valentine validations
      try {
        await validateOrderValentineRules(orderData.items, orderData.shippingDetails);
      } catch (valError) {
        return res.status(400).json({
          success: false,
          message: valError.message
        });
      }

      const userId = req.user?._id || null;
      if (!userId && (!orderData.shippingDetails?.email || !orderData.shippingDetails?.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Email and phone number are required for guest checkout'
        });
      }

      // Generate order number in YYMM-XXX-DD format
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      // Find the last order for the current year and month
      const lastOrder = await Order.findOne({
        orderNumber: new RegExp(`^${year}${month}`)
      }, {}, { sort: { 'orderNumber': -1 } });

      let sequence = '001';
      if (lastOrder) {
        // Extract the sequence number from the last order (positions 4-6 in YYMMDDDDD format)
        const lastSequence = parseInt(lastOrder.orderNumber.substring(4, 7));
        sequence = (lastSequence + 1).toString().padStart(3, '0');
      }

      const orderNumber = `${year}${month}${sequence}${day}`;

      // Server-side calculation and validation
      const subtotalCalculated = orderData.items.reduce((sum, item) => sum + (item.finalPrice || item.price) * item.quantity, 0);

      const deliveryChargeResult = await calculateDeliveryFee({
        subtotal: subtotalCalculated,
        timeSlot: orderData.shippingDetails.timeSlot,
        userId,
        email: orderData.shippingDetails.email,
        phone: orderData.shippingDetails.phone
      });
      const deliveryChargeCalculated = deliveryChargeResult.deliveryCharge;
      const isFirstOrderFreeDelivery = deliveryChargeResult.isFirstOrderFreeDelivery;

      // Validate subtotal if sent
      if (orderData.subtotal !== undefined && Math.abs(orderData.subtotal - subtotalCalculated) > 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid subtotal. Expected ${subtotalCalculated}, got ${orderData.subtotal}`
        });
      }

      // Validate delivery charge if sent
      if (orderData.deliveryCharge !== undefined && Math.abs(orderData.deliveryCharge - deliveryChargeCalculated) > 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid delivery charge. Expected ${deliveryChargeCalculated}, got ${orderData.deliveryCharge}`
        });
      }

      const discount = orderData.discount !== undefined
        ? orderData.discount
        : Math.max(0, subtotalCalculated + deliveryChargeCalculated - orderData.totalAmount);

      const finalTotal = subtotalCalculated + deliveryChargeCalculated - discount;

      if (Math.abs(orderData.totalAmount - finalTotal) > 1) {
        return res.status(400).json({
          success: false,
          message: `Total amount mismatch. Calculated ${finalTotal}, got ${orderData.totalAmount}`
        });
      }

      // Create the order object with all required fields
      const orderDbData = {
        orderNumber,
        user: userId,
        shippingDetails: {
          fullName: orderData.shippingDetails.fullName,
          email: orderData.shippingDetails.email,
          phone: orderData.shippingDetails.phone,
          address: orderData.shippingDetails.address,
          apartment: orderData.shippingDetails.apartment || '',
          city: orderData.shippingDetails.city,
          state: orderData.shippingDetails.state,
          zipCode: orderData.shippingDetails.zipCode,
          notes: orderData.shippingDetails.notes || '',
          deliveryDate: orderData.shippingDetails.deliveryDate,
          timeSlot: orderData.shippingDetails.timeSlot
        },
        items: orderData.items.map(item => ({
          product: item.product,
          title: item.title || '',
          image: item.image || item.images?.[0] || '',
          images: Array.isArray(item.images) ? item.images : [],
          selectedVariant: item.selectedVariant || null,
          quantity: item.quantity,
          price: item.price,
          finalPrice: item.finalPrice,
          customizations: item.customizations || null
        })),
        paymentDetails: {
          method: 'razorpay',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        },
        totalAmount: finalTotal,
        subtotal: subtotalCalculated,
        deliveryCharge: deliveryChargeCalculated,
        discount,
        finalTotal,
        isFirstOrderFreeDelivery,
        currency: orderData.currency || 'INR',
        currencyRate: orderData.currencyRate || 1,
        originalCurrency: orderData.originalCurrency || orderData.currency || 'INR',
        status: 'order_placed',
        promoCode: orderData.promoCode || undefined
      };

      // Add gift details if present
      if (orderData.giftDetails) {
        orderDbData.giftDetails = orderData.giftDetails;
      }

      console.log('Creating order with verified payment data:', JSON.stringify(orderDbData, null, 2));

      const order = new Order(orderDbData);
      const savedOrder = await order.save();

      // Track campaign conversion if promo code is used
      if (savedOrder.promoCode) {
        await trackPromoCodeConversion(savedOrder.promoCode);
      }

      console.log('Order saved successfully after payment verification:', JSON.stringify(savedOrder, null, 2));

      // Send notifications after order is successfully created
      try {
        // Get customer details (for logged in, fetch from User, for guest, use shippingDetails)
        const customer = userId 
          ? await User.findById(userId)
          : {
              name: savedOrder.shippingDetails.fullName,
              email: savedOrder.shippingDetails.email,
              phone: savedOrder.shippingDetails.phone
            };

        // Populate product details for notifications
        const populatedOrder = await Order.findById(savedOrder._id)
          .populate({
            path: 'items.product',
            select: 'name title price images'
          });

        // Prepare notification data
        const notificationData = {
          order: populatedOrder,
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone || populatedOrder.shippingDetails.phone
          },
          items: populatedOrder.items
        };

        // Send email notification (includes both customer and admin emails)
        const emailResult = await sendEmailNotification(notificationData);
        console.log('Email notification result:', emailResult);

        // Create admin notification for real-time updates
        try {
          const adminNotification = await createOrderNotification({
            orderId: savedOrder._id,
            orderNumber: savedOrder.orderNumber,
            customerName: customer.name,
            amount: savedOrder.totalAmount,
            currency: savedOrder.currency || 'INR'
          });
          console.log('✅ Admin notification created successfully for order:', savedOrder.orderNumber);

          // Store in a global variable for real-time polling (optional backup)
          global.latestNotifications = global.latestNotifications || [];
          global.latestNotifications.unshift({
            id: adminNotification.id || `order-${Date.now()}`,
            type: 'order',
            title: '🎉 New Order Received!',
            message: `Order ${savedOrder.orderNumber} placed by ${customer.name}. Amount: ${savedOrder.currency === 'INR' ? '₹' : '$'}${savedOrder.totalAmount}`,
            createdAt: new Date().toISOString(),
            isRead: false,
            orderId: savedOrder._id,
            orderNumber: savedOrder.orderNumber
          });

          // Keep only last 50 notifications in memory
          if (global.latestNotifications.length > 50) {
            global.latestNotifications = global.latestNotifications.slice(0, 50);
          }

          console.log('📨 Notification added to global notifications for real-time polling');

          // Send FCM push notification to all admin devices
          try {
            console.log('🔔 Sending push notification to all admin devices...');
            const fcmResult = await sendToAllAdmins({
              title: '🎉 New Order Received!',
              body: `Order #${savedOrder.orderNumber} - ${savedOrder.currency === 'INR' ? '₹' : '$'}${savedOrder.totalAmount}`,
              orderId: savedOrder._id.toString(),
              orderNumber: savedOrder.orderNumber,
              customerName: customer.name,
              amount: savedOrder.totalAmount.toString(),
              type: 'NEW_ORDER'
            });
            console.log('📱 Sent push notification to all admins:', fcmResult);
          } catch (fcmError) {
            console.error('❌ Error sending FCM push notification:', fcmError.message);
          }

        } catch (adminNotificationError) {
          console.error('❌ Error creating admin notification:', adminNotificationError);
        }

        // Add notification status to response
        savedOrder.emailNotificationStatus = emailResult;

      } catch (notificationError) {
        console.error('❌ Error sending order notifications:', notificationError);
        // Don't fail the order creation if notifications fail
      }

      // Populate the order with product details before sending to frontend
      const populatedOrder = await Order.findById(savedOrder._id)
        .populate({
          path: 'items.product',
          select: 'name title price images sku discount'
        });

      res.json({
        success: true,
        order: populatedOrder
      });
    } else {
      // If no orderData, just return verification result
      res.json({
        success: true
      });
    }
  } catch (error) {
    console.error('Error verifying payment and creating order:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get upcoming deliveries with highlighting
// @route   GET /api/orders/upcoming-deliveries
// @access  Private/Admin
const getUpcomingDeliveries = async (req, res) => {
  try {
    const { days = 7 } = req.query; // Default to 7 days ahead

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + parseInt(days));

    // Find orders with delivery dates within the specified range
    const orders = await Order.find({
      'shippingDetails.deliveryDate': {
        $gte: now,
        $lte: futureDate
      },
      status: { $in: ['order_placed', 'received', 'being_made', 'out_for_delivery'] } // Exclude cancelled and delivered
    })
      .populate('user', 'name email')
      .populate('items.product', 'title images price')
      .sort({ 'shippingDetails.deliveryDate': 1 }); // Sort by delivery date ascending

    // Add highlighting information
    const ordersWithHighlight = orders.map(order => {
      const deliveryDate = order.shippingDetails?.deliveryDate;
      let highlight = null;
      let priority = 'low';

      if (deliveryDate) {
        const deliveryDateTime = new Date(deliveryDate);
        const diffInDays = Math.ceil((deliveryDateTime - now) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) {
          highlight = {
            type: 'today',
            urgency: 'critical',
            message: 'Delivery today!',
            color: 'red',
            bgColor: 'bg-red-50 border-red-200',
            textColor: 'text-red-800'
          };
          priority = 'critical';
        } else if (diffInDays === 1) {
          highlight = {
            type: 'tomorrow',
            urgency: 'high',
            message: 'Delivery tomorrow',
            color: 'orange',
            bgColor: 'bg-orange-50 border-orange-200',
            textColor: 'text-orange-800'
          };
          priority = 'high';
        } else if (diffInDays <= 3) {
          highlight = {
            type: 'soon',
            urgency: 'medium',
            message: `Delivery in ${diffInDays} days`,
            color: 'yellow',
            bgColor: 'bg-yellow-50 border-yellow-200',
            textColor: 'text-yellow-800'
          };
          priority = 'medium';
        } else {
          highlight = {
            type: 'upcoming',
            urgency: 'low',
            message: `Delivery in ${diffInDays} days`,
            color: 'blue',
            bgColor: 'bg-blue-50 border-blue-200',
            textColor: 'text-blue-800'
          };
          priority = 'low';
        }
      }

      return {
        ...order.toObject(),
        deliveryHighlight: highlight,
        priority
      };
    });

    // Group by priority
    const groupedOrders = {
      critical: ordersWithHighlight.filter(o => o.priority === 'critical'),
      high: ordersWithHighlight.filter(o => o.priority === 'high'),
      medium: ordersWithHighlight.filter(o => o.priority === 'medium'),
      low: ordersWithHighlight.filter(o => o.priority === 'low')
    };

    // Statistics
    const stats = {
      total: ordersWithHighlight.length,
      today: groupedOrders.critical.length,
      tomorrow: groupedOrders.high.length,
      next3Days: groupedOrders.medium.length,
      later: groupedOrders.low.length
    };

    res.json({
      success: true,
      orders: ordersWithHighlight,
      groupedOrders,
      stats,
      dateRange: {
        from: now.toISOString(),
        to: futureDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching upcoming deliveries:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch upcoming deliveries',
      error: error.message
    });
  }
};

// @desc    Get delivery calendar data
// @route   GET /api/orders/delivery-calendar
// @access  Private/Admin
const getDeliveryCalendar = async (req, res) => {
  try {
    const { month, year } = req.query;

    // Default to current month if not specified
    const targetDate = new Date();
    if (month) targetDate.setMonth(parseInt(month) - 1);
    if (year) targetDate.setFullYear(parseInt(year));

    // Get first and last day of the month
    const firstDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    // Find all orders with delivery dates in this month
    const orders = await Order.find({
      'shippingDetails.deliveryDate': {
        $gte: firstDay,
        $lte: lastDay
      }
    })
      .populate('user', 'name email')
      .populate('items.product', 'title')
      .sort({ 'shippingDetails.deliveryDate': 1 });

    // Group orders by date
    const calendarData = {};

    orders.forEach(order => {
      const deliveryDate = order.shippingDetails?.deliveryDate;
      if (deliveryDate) {
        const dateKey = new Date(deliveryDate).toISOString().split('T')[0];

        if (!calendarData[dateKey]) {
          calendarData[dateKey] = {
            date: dateKey,
            orders: [],
            count: 0,
            totalAmount: 0,
            statusCounts: {
              pending: 0,
              processing: 0,
              completed: 0,
              delivered: 0,
              cancelled: 0
            }
          };
        }

        calendarData[dateKey].orders.push({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.shippingDetails.fullName,
          status: order.status,
          totalAmount: order.totalAmount,
          timeSlot: order.shippingDetails.timeSlot,
          itemCount: order.items.length
        });

        calendarData[dateKey].count++;
        calendarData[dateKey].totalAmount += order.totalAmount;
        calendarData[dateKey].statusCounts[order.status]++;
      }
    });

    res.json({
      success: true,
      calendarData,
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      totalOrders: orders.length
    });
  } catch (error) {
    console.error('Error fetching delivery calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch delivery calendar',
      error: error.message
    });
  }
};

// @desc    Test delivery email functionality
// @route   POST /api/orders/test-delivery-email
// @access  Private/Admin
const testDeliveryEmail = async (req, res) => {
  try {
    const { orderId } = req.body;
    console.log(`[Order Controller] 🧪 testDeliveryEmail trigger request received for order ID: ${orderId}`);

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId).populate({
      path: 'items.product',
      select: 'title price images sku discount'
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get customer details - try User model first, then fallback to shipping details
    const User = require('../models/User');
    let customer = null;
    let customerEmail = null;
    let customerName = null;

    // Try to get customer from User model
    if (order.user) {
      customer = await User.findById(order.user);
      console.log('👤 Customer lookup result:', customer ? 'Found' : 'Not found');
      console.log('📧 Customer email from User model:', customer?.email);

      if (customer && customer.email) {
        customerEmail = customer.email;
        customerName = customer.name;
      }
    }

    // Fallback to shipping details email if User model email not found
    if (!customerEmail && order.shippingDetails && order.shippingDetails.email) {
      customerEmail = order.shippingDetails.email;
      customerName = order.shippingDetails.fullName;
      console.log('📧 Using email from shipping details:', customerEmail);
    }

    if (!customerEmail) {
      return res.status(400).json({
        message: 'Customer email not found in User model or shipping details',
        orderUser: order.user,
        shippingEmail: order.shippingDetails?.email
      });
    }

    console.log('🧪 Testing delivery email for order:', order.orderNumber);
    console.log('📧 Customer email:', customerEmail);

    // Prepare delivery notification data
    const deliveryNotificationData = {
      order: order,
      customer: {
        name: customerName || order.shippingDetails.fullName,
        email: customerEmail,
        phone: customer?.phone || order.shippingDetails.phone
      },
      items: order.items
    };

    console.log(`[Order Controller] 👤 Resolved customer for test: Name="${customerName || order.shippingDetails.fullName}", Email="${customerEmail}"`);
    console.log(`[Order Controller] 📤 Triggering sendDeliveryConfirmationWithInvoice for test order #${order.orderNumber}`);

    // Send delivery confirmation email with invoice
    const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');
    const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);

    console.log(`[Order Controller] 🧪 sendDeliveryConfirmationWithInvoice output for test order #${order.orderNumber}:`, emailResult);

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Test delivery email sent successfully',
        orderNumber: order.orderNumber,
        customerEmail: customerEmail,
        messageId: emailResult.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test delivery email',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('❌ Error in test delivery email:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get invoice PDF for an order
// @route   GET /api/orders/:id/invoice
// @access  Private
const getOrderInvoice = async (req, res) => {
  try {
    console.log('📄 getOrderInvoice called for order ID:', req.params.id);

    // Fetch the order and populate product details
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'items.product',
        select: 'name title price images sku discount'
      })
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization: ensure order owner, admin, or verified guest can download
    let authorized = false;

    // Check if user is logged in
    if (req.user) {
      const isOwner = order.user && order.user._id && order.user._id.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      if (isOwner || isAdmin) {
        authorized = true;
      }
    }

    // If not authorized by login, check guest query parameters
    if (!authorized) {
      const { email, phone } = req.query;
      const shippingEmail = order.shippingDetails?.email;
      const shippingPhone = order.shippingDetails?.phone;

      const emailMatches = email && shippingEmail && email.trim().toLowerCase() === shippingEmail.trim().toLowerCase();
      
      let phoneMatches = false;
      if (phone && shippingPhone) {
        const cleanPhoneInput = phone.trim().replace(/[\s-+]/g, '');
        const cleanPhoneShipping = shippingPhone.trim().replace(/[\s-+]/g, '');
        const inputLast10 = cleanPhoneInput.slice(-10);
        const shippingLast10 = cleanPhoneShipping.slice(-10);
        if (inputLast10.length >= 10 && shippingLast10.length >= 10) {
          phoneMatches = inputLast10 === shippingLast10;
        } else {
          phoneMatches = cleanPhoneInput === cleanPhoneShipping;
        }
      }

      if (emailMatches || phoneMatches) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
    }

    // Build customer object from order data
    const customer = {
      name: order.user?.name || order.shippingDetails?.fullName || 'Customer',
      email: order.user?.email || order.shippingDetails?.email || '',
      phone: order.user?.phone || order.shippingDetails?.phone || ''
    };

    // Prepare data for invoice generation
    const orderData = { order, customer };

    // Generate the HTML invoice using the shared template
    const { generateInvoiceHTML, generateInvoicePDF } = require('../services/emailNotificationService');
    const htmlContent = generateInvoiceHTML(orderData);

    // Convert HTML to PDF
    const pdfBuffer = await generateInvoicePDF(htmlContent, order.orderNumber);

    console.log('✅ Invoice PDF generated for order:', order.orderNumber);

    // Set response headers and send PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Invoice-${order.orderNumber}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ Error generating invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invoice', error: error.message });
  }
};

// @desc    Calculate delivery fee dynamically
// @route   POST /api/orders/calculate-delivery
// @access  Public (Optional auth)
const calculateDelivery = async (req, res) => {
  try {
    const { subtotal, timeSlot, email, phone } = req.body;
    const userId = req.user?._id || null;

    if (subtotal === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Subtotal is required'
      });
    }

    const calculation = await calculateDeliveryFee({
      subtotal: Number(subtotal),
      timeSlot,
      userId,
      email,
      phone
    });

    res.json({
      success: true,
      ...calculation
    });
  } catch (error) {
    console.error('Error in calculateDelivery:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating delivery fee',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getNextOrderNumber,
  getOrderById,
  getOrderInvoice,
  updateOrderToPaid,
  updateOrderToDelivered,
  getUserOrders,
  getOrders,
  getTodayOrders,
  updateOrderStatus,
  createRazorpayOrder: createRazorpayOrderHandler,
  verifyRazorpayPayment: verifyRazorpayPaymentHandler,
  getUpcomingDeliveries,
  getDeliveryCalendar,
  testDeliveryEmail,
  calculateDelivery,
};
