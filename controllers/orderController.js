const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const moment = require('moment'); // Import moment.js for date formatting
const { createOrder: createRazorpayOrder, verifyPayment } = require('../services/razorpayService');
const Notification = require('../models/Notification');
const { admin } = require('../middleware/authMiddleware');
const { createOrderNotification } = require('./notificationController');
const { sendEmailNotification } = require('../services/emailNotificationService');


// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    // Debug logs
    console.log('User from request:', req.user);
    console.log('Received order data:', JSON.stringify(req.body, null, 2));

    const { shippingDetails, items, paymentDetails, totalAmount, giftDetails, currency, currencyRate, originalCurrency } = req.body;

    // Validate required data
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain items'
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
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
      // Extract the sequence number from the last order
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[1]);
      sequence = (lastSequence + 1).toString().padStart(3, '0');
    }

    const orderNumber = `${year}${month}-${sequence}-${day}`;

    // Create the order object with all required fields
    const orderData = {
      orderNumber,
      user: req.user._id,
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
        deliveryDate: shippingDetails.deliveryDate,
        timeSlot: shippingDetails.timeSlot
      },
      items: items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        finalPrice: item.finalPrice
      })),
      paymentDetails: {
        method: paymentDetails.method,
        razorpayOrderId: paymentDetails.razorpayOrderId,
        razorpayPaymentId: paymentDetails.razorpayPaymentId,
        razorpaySignature: paymentDetails.razorpaySignature
      },
      totalAmount,
      currency: currency || 'INR',
      currencyRate: currencyRate || 1,
      originalCurrency: originalCurrency || currency || 'INR',
      status: 'order_placed'
    };

    // Add gift details if present
    if (giftDetails) {
      orderData.giftDetails = giftDetails;
    }

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const order = new Order(orderData);
    const savedOrder = await order.save();

    console.log('Order saved successfully:', JSON.stringify(savedOrder, null, 2));

    // Send notifications after order is successfully created
    try {
      // Get customer details
      const customer = await User.findById(req.user._id);
      
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

      // Send email notification
      const emailResult = await sendEmailNotification(notificationData);
      
      console.log('Email notification result:', emailResult);
      
      // Create admin notification for the order
      try {
        await createOrderNotification({
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          customerName: customer.name,
          amount: savedOrder.totalAmount
        });
        console.log('Admin notification created successfully for order:', savedOrder.orderNumber);
      } catch (adminNotificationError) {
        console.error('Error creating admin notification:', adminNotificationError);
      }
      
      // Add notification status to response
      savedOrder.emailNotificationStatus = emailResult;
      
    } catch (notificationError) {
      console.error('Error sending order notifications:', notificationError);
      // Don't fail the order creation if notifications fail
    }

    res.status(201).json({
      success: true,
      order: savedOrder
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
      orderNumber: new RegExp(`^${year}${month}${day}`)
    }, {}, { sort: { 'orderNumber': -1 } });

    let sequence = '001';
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
      sequence = (lastSequence + 1).toString().padStart(3, '0');
    }

    const nextOrderNumber = `${year}${month}${day}-${sequence}`;
    
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
        select: 'name price images sku discount' // Include all needed fields
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
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      order.status = 'delivered';

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name')
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
      highlight3Days
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
          select: 'title images price discount'
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

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const previousStatus = order.status;
    order.status = status;
    
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    // Update stock when order is confirmed (being_made or delivered)
    if ((status === 'being_made' || status === 'delivered') && !['being_made', 'delivered'].includes(previousStatus) && !order.stockUpdated) {
      console.log('Order confirmed, updating stock for items:', order.items);
      
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          // Check if we have enough stock
          if (product.countInStock >= item.quantity) {
            product.countInStock -= item.quantity;
            await product.save();
            console.log(`Updated stock for product ${product.title}: ${product.countInStock + item.quantity} -> ${product.countInStock}`);
          } else {
            console.log(`Warning: Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${item.quantity}`);
            // You could throw an error here or handle it differently
            return res.status(400).json({ 
              message: `Insufficient stock for product ${product.title}. Available: ${product.countInStock}, Required: ${item.quantity}` 
            });
          }
        }
      }

      // Mark stock as updated
      order.stockUpdated = true;

      // Create order confirmation notification for admin
      try {
        await createOrderNotification({
          orderId: order._id,
          orderNumber: order.orderNumber,
          customerName: order.shippingDetails?.fullName || 'Unknown Customer',
          amount: order.totalAmount
        });
      } catch (notificationError) {
        console.error('Error creating order notification:', notificationError);
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
    }

    // Restore stock if order is cancelled from being_made or delivered status
    if (status === 'cancelled' && ['being_made', 'delivered'].includes(previousStatus) && order.stockUpdated) {
      console.log('Order cancelled from completed status, restoring stock for items:', order.items);
      
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.countInStock += item.quantity;
          await product.save();
          console.log(`Restored stock for product ${product.title}: ${product.countInStock - item.quantity} -> ${product.countInStock}`);
        }
      }

      // Mark stock as not updated since we restored it
      order.stockUpdated = false;

      // Create notification for stock restoration
      try {
        const notification = new Notification({
          title: 'Stock Restored',
          message: `Stock restored for cancelled order ${order.orderNumber}. ${order.items.length} products' stock restored.`,
          type: 'info',
          read: false
        });
        await notification.save();
      } catch (notificationError) {
        console.error('Error creating stock restoration notification:', notificationError);
      }
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
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

module.exports = {
  createOrder,
  getNextOrderNumber,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getUserOrders,
  getOrders,
  updateOrderStatus,
  createRazorpayOrder: createRazorpayOrderHandler,
  verifyRazorpayPayment: verifyRazorpayPaymentHandler,
  getUpcomingDeliveries,
  getDeliveryCalendar,
};
