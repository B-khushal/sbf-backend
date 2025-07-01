const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const moment = require('moment'); // Import moment.js for date formatting
const { createOrder: createRazorpayOrder, verifyPayment } = require('../services/razorpayService');
const Notification = require('../models/Notification');
const { admin } = require('../middleware/authMiddleware');
const { createOrderNotification } = require('./notificationController');
const { sendEmailNotification, sendDeliveryConfirmationWithInvoice, sendOrderConfirmationEmail } = require('../services/emailNotificationService');
const { sendNotification } = require('../services/notificationService');

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


// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      promoCode,
      discountAmount,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    const order = new Order({
      user: req.user._id,
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      promoCode,
      discountAmount,
    });

    const createdOrder = await order.save();

    // Send order confirmation email
    await sendOrderConfirmationEmail(req.user.email, createdOrder);

    // Send notification
    await sendNotification(req.user._id, {
      title: 'Order Placed',
      message: `Your order #${createdOrder._id} has been placed successfully`,
      type: 'order',
      orderId: createdOrder._id,
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Error in addOrderItems:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product', 'title images price countInStock');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if the user is authorized to view this order
    if (!req.user.isAdmin && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error in getOrderById:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    };

    const updatedOrder = await order.save();

    // Send payment confirmation notification
    await sendNotification(order.user, {
      title: 'Payment Received',
      message: `Payment for order #${order._id} has been received`,
      type: 'payment',
      orderId: order._id,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error in updateOrderToPaid:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();
    order.status = 'delivered';

    const updatedOrder = await order.save();

    // Send delivery notification
    await sendNotification(order.user, {
      title: 'Order Delivered',
      message: `Your order #${order._id} has been delivered`,
      type: 'delivery',
      orderId: order._id,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error in updateOrderToDelivered:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'title images');
    res.json(orders);
  } catch (error) {
    console.error('Error in getMyOrders:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const pageSize = 20;
    const page = Number(req.query.page) || 1;
    const status = req.query.status;

    const query = status ? { status } : {};

    const count = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user', 'id name')
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize);

    res.json({
      orders,
      page,
      pages: Math.ceil(count / pageSize),
      total: count,
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    const updatedOrder = await order.save();

    // Send status update notification
    await sendNotification(order.user, {
      title: 'Order Status Updated',
      message: `Your order #${order._id} status has been updated to ${status}`,
      type: 'status',
      orderId: order._id,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow cancellation if order is pending or processing
    if (!['pending', 'processing'].includes(order.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled' });
    }

    // Check if user is authorized
    if (!req.user.isAdmin && order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    order.status = 'cancelled';
    const updatedOrder = await order.save();

    // Send cancellation notification
    await sendNotification(order.user, {
      title: 'Order Cancelled',
      message: `Your order #${order._id} has been cancelled`,
      type: 'cancellation',
      orderId: order._id,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private/Admin
const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);

    const monthlyRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$totalPrice' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    res.json({
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue,
    });
  } catch (error) {
    console.error('Error in getOrderStats:', error);
    res.status(500).json({ message: 'Server Error' });
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

    console.log('Creating Razorpay order with:', { amount, currency });
    const order = await createRazorpayOrder(amount, currency);
    console.log('Razorpay order created:', order);
    
    res.json({
      success: true,
      amount: order.amount,
      currency: order.currency,
      id: order.id
    });
  } catch (error) {
    console.error('Detailed error creating Razorpay order:', error);
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
      razorpay_signature
    } = req.body;

    const isValid = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    res.json({
      success: isValid
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment'
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
    
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get customer details
    const User = require('../models/User');
    const customer = await User.findById(order.user);
    
    if (!customer || !customer.email) {
      return res.status(400).json({ message: 'Customer or customer email not found' });
    }

    console.log('🧪 Testing delivery email for order:', order.orderNumber);
    console.log('📧 Customer email:', customer.email);
    
    // Prepare delivery notification data
    const deliveryNotificationData = {
      order: order,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || order.shippingDetails.phone
      },
      items: order.items
    };

    // Send delivery confirmation email with invoice
    const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');
    const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);
    
    console.log('🧪 Test email result:', emailResult);
    
    if (emailResult.success) {
      res.json({ 
        success: true, 
        message: 'Test delivery email sent successfully',
        orderNumber: order.orderNumber,
        customerEmail: customer.email,
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

module.exports = {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderStats,
  createRazorpayOrder: createRazorpayOrderHandler,
  verifyRazorpayPayment: verifyRazorpayPaymentHandler,
  getUpcomingDeliveries,
  getDeliveryCalendar,
  testDeliveryEmail,
};
