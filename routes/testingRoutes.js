const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const DeliveryZone = require('../models/DeliveryZone');
const DeliveryPartner = require('../models/DeliveryPartner');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const DeviceToken = require('../models/DeviceToken');
const DeliverySetting = require('../models/DeliverySetting');
const deliveryService = require('../services/deliveryService');
const deliveryNotificationService = require('../services/deliveryNotificationService');
const fcmService = require('../services/fcmService');

// Helper to seed test requirements (Zone, Product, Partner, Setting)
const prepareTestingEnvironment = async () => {
  // 1. Ensure Delivery Settings allow auto assign and have large enough radius
  let settings = await DeliverySetting.findOne();
  if (!settings) {
    settings = await DeliverySetting.create({
      autoAssign: true,
      assignmentRadius: 25,
      maxOrdersPerPartner: 3,
      reassignmentTimeout: 60,
      baseDeliveryEarning: 80,
      earningPerKm: 15,
      peakHourMultiplier: 1.0
    });
  } else {
    settings.autoAssign = true;
    settings.assignmentRadius = 25;
    await settings.save();
  }

  // 2. Ensure Jubilee Hills Delivery Zone exists
  let zone = await DeliveryZone.findOne({ name: 'Jubilee Hills' });
  if (!zone) {
    zone = await DeliveryZone.create({
      name: 'Jubilee Hills',
      city: 'Hyderabad',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [78.3800, 17.4100],
          [78.4300, 17.4100],
          [78.4300, 17.4500],
          [78.3800, 17.4500],
          [78.3800, 17.4100]
        ]]
      },
      baseDeliveryCharge: 150,
      isActive: true
    });
  }

  // 3. Ensure a test Product exists
  let product = await Product.findOne({ title: '20 Red Roses Bouquet' });
  if (!product) {
    // Find any admin user or create one
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.findOne({ role: 'platform_admin' });
    }
    const userId = adminUser ? adminUser._id : null;

    product = await Product.create({
      user: userId,
      title: '20 Red Roses Bouquet',
      price: 1200,
      category: 'Roses',
      description: 'Elegant arrangement of 20 fresh red roses',
      images: ['/images/red-roses-bouquet.jpg'],
      productType: 'regular',
      isValentineProduct: false,
      countInStock: 9999
    });
  }

  // 4. Ensure a test Delivery Partner exists
  let partner = await DeliveryPartner.findOne({ email: 'rahul.driver@sbflorist.in' });
  if (!partner) {
    partner = await DeliveryPartner.create({
      name: 'Rahul Sharma (Driver)',
      email: 'rahul.driver@sbflorist.in',
      phone: '9876543210',
      password: 'password123',
      vehicleType: 'bike',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      licenseNumber: 'TS0920261234567',
      status: 'online',
      availability: 'available',
      approvalStatus: 'approved',
      currentLatitude: 17.4320,
      currentLongitude: 78.4070,
      zone: zone._id,
      rating: 4.8
    });
  } else {
    // Make sure partner is online, available, near, and in zone
    partner.status = 'online';
    partner.availability = 'available';
    partner.isSuspended = false;
    partner.currentLatitude = 17.4320;
    partner.currentLongitude = 78.4070;
    partner.zone = zone._id;
    await partner.save();
  }

  // 5. Ensure Device Token exists for the test partner
  let tokenDoc = await DeviceToken.findOne({ userId: partner._id });
  if (!tokenDoc) {
    tokenDoc = await DeviceToken.create({
      userId: partner._id,
      token: 'mock-fcm-token-rahul-sharma',
      deviceType: 'android',
      isActive: true,
      metadata: { model: 'Google Pixel 8', appVersion: '1.0.0' }
    });
  } else {
    tokenDoc.isActive = true;
    await tokenDoc.save();
  }

  return { settings, zone, product, partner, tokenDoc };
};

// 1. POST /api/testing/create-test-order
router.post('/create-test-order', async (req, res) => {
  try {
    const env = await prepareTestingEnvironment();

    // Generate Order Number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const sequence = Math.floor(100 + Math.random() * 900).toString(); // Random 3-digit sequence
    const orderNumber = `${year}${month}${sequence}${day}`;

    // Create Order with coordinates and flags
    const newOrder = await Order.create({
      orderNumber,
      shippingDetails: {
        fullName: 'Rahul Sharma',
        email: 'rahul.sharma@example.com',
        phone: '9876543210',
        address: 'Road No 36, Jubilee Hills, Hyderabad',
        apartment: 'Plot 45, 2nd Floor',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500033',
        notes: 'Prepaid testing order',
        deliveryDate: new Date(),
        timeSlot: '12:00 PM - 03:00 PM',
        latitude: 17.4325,
        longitude: 78.4075,
        deliveryRequired: true
      },
      items: [{
        product: env.product._id,
        productModel: 'Product',
        title: env.product.title,
        image: env.product.images[0],
        quantity: 1,
        price: 1200,
        finalPrice: 1200
      }],
      paymentDetails: {
        method: 'razorpay',
        razorpayOrderId: 'pay_test_' + Date.now(),
        razorpayPaymentId: 'pay_verify_' + Date.now(),
        razorpaySignature: 'sig_test_' + Date.now()
      },
      totalAmount: 1350,
      subtotal: 1200,
      deliveryCharge: 150,
      discount: 0,
      finalTotal: 1350,
      currency: 'INR',
      status: 'received', // Marks order as received/paid, making it ready for dispatch
      isPaid: true,
      paidAt: new Date()
    });

    // Create tracking history
    newOrder.trackingHistory.push({
      status: 'order_placed',
      message: 'Test order created via Developer Testing Tool'
    });
    newOrder.trackingHistory.push({
      status: 'received',
      message: 'Payment verified and order confirmed'
    });
    await newOrder.save();

    console.log(`[Testing] Test Order #${orderNumber} created successfully.`);

    res.status(201).json({
      success: true,
      message: 'Test order created successfully',
      order: newOrder,
      environment: {
        partnerId: env.partner._id,
        zoneId: env.zone._id,
        productId: env.product._id
      }
    });
  } catch (error) {
    console.error('[Testing] Create Order Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. POST /api/testing/send-test-assignment
router.post('/send-test-assignment', async (req, res) => {
  try {
    const { orderId } = req.body;
    let order;
    if (orderId) {
      order = await Order.findById(orderId);
    } else {
      order = await Order.findOne({ status: 'received' }).sort({ createdAt: -1 });
    }

    if (!order) {
      return res.status(400).json({ success: false, message: 'No eligible test orders found in database. Create a test order first.' });
    }

    console.log(`[Testing] Triggering automated assignment for Order ${order.orderNumber}...`);
    
    // Trigger the actual assignment algorithm
    const success = await deliveryService.assignOrderAutomatically(order._id);
    
    // Find the assignment that was created/updated
    const assignment = await DeliveryAssignment.findOne({ orderId: order._id }).populate('partnerId');

    res.json({
      success: true,
      message: success ? 'Auto-assignment completed successfully' : 'Auto-assignment processed (but no partners found or setup as pending)',
      assignment,
      orderStatus: order.status
    });
  } catch (error) {
    console.error('[Testing] Run Assignment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. POST /api/testing/send-test-fcm
router.post('/send-test-fcm', async (req, res) => {
  try {
    const { partnerId } = req.body;
    let partner;
    if (partnerId) {
      partner = await DeliveryPartner.findById(partnerId);
    } else {
      partner = await DeliveryPartner.findOne({ email: 'rahul.driver@sbflorist.in' });
    }

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found. Run create-test-order to seed environment.' });
    }

    // Find the latest assignment or create a fake one for testing
    let assignment = await DeliveryAssignment.findOne({ partnerId: partner._id }).sort({ createdAt: -1 });
    let order;
    if (assignment) {
      order = await Order.findById(assignment.orderId);
    }

    const orderIdStr = order ? order._id.toString() : 'mock-order-id-999';
    const assignmentIdStr = assignment ? assignment._id.toString() : 'mock-assignment-id-999';
    const orderNumberStr = order ? order.orderNumber : 'SBF-12345';

    console.log(`[Testing] Dispatching test FCM notification directly to partner ${partner.name}...`);
    
    const payload = {
      type: 'NEW_ASSIGNMENT',
      assignmentId: assignmentIdStr,
      orderId: orderIdStr,
      customerName: order ? order.shippingDetails.fullName : 'Rahul Sharma',
      deliveryAddress: order ? order.shippingDetails.address : 'Road No 36, Jubilee Hills, Hyderabad',
      distance: assignment ? String(assignment.distance || '1.5') + ' km' : '1.4 km',
      estimatedTime: assignment ? String(assignment.eta || '20') + ' mins' : '18 mins',
      expiresIn: '60'
    };

    const notificationResult = await deliveryNotificationService.sendPushNotification(
      partner._id,
      'New Order Request 🌸',
      `Order #${orderNumberStr} is available for pickup. Open app to accept.`,
      payload
    );

    res.json({
      success: true,
      message: 'Test FCM Notification dispatched successfully',
      payload,
      notificationResult
    });
  } catch (error) {
    console.error('[Testing] FCM Dispatch Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. GET /api/testing/assignment-status/:orderId
router.get('/assignment-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const assignment = await DeliveryAssignment.findOne({ orderId }).populate('partnerId');
    
    res.json({
      success: true,
      orderStatus: order.status,
      assignmentExists: !!assignment,
      assignmentStatus: assignment ? assignment.status : null,
      history: assignment ? assignment.history : [],
      assignment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. GET /api/testing/fcm-status/:partnerId
router.get('/fcm-status/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    }

    const tokens = await DeviceToken.find({ userId: partnerId });
    const activeZone = await DeliveryZone.findById(partner.zone);

    res.json({
      success: true,
      partner: {
        _id: partner._id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        status: partner.status,
        availability: partner.availability,
        isSuspended: partner.isSuspended
      },
      tokensCount: tokens.length,
      activeTokens: tokens.filter(t => t.isActive).map(t => ({
        token: t.token,
        deviceType: t.deviceType,
        deviceName: t.metadata?.model || 'Unknown Device',
        updatedAt: t.updatedAt
      })),
      zone: activeZone ? {
        _id: activeZone._id,
        name: activeZone.name,
        isActive: activeZone.isActive
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. POST /api/testing/test-order-emails/:orderNumber
router.post('/test-order-emails/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { sendEmailNotification, sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');

    const customerDetails = {
      order,
      customer: {
        name: order.shippingDetails?.fullName || 'Test Customer',
        email: order.shippingDetails?.email || 'test@example.com',
        phone: order.shippingDetails?.phone || '9876543210'
      },
      items: order.items || []
    };

    console.log(`[Testing] Triggering sendEmailNotification for Order ${orderNumber}...`);
    const emailResult = await sendEmailNotification(customerDetails);

    console.log(`[Testing] Triggering sendDeliveryConfirmationWithInvoice for Order ${orderNumber}...`);
    const invoiceResult = await sendDeliveryConfirmationWithInvoice(customerDetails);

    res.json({
      success: true,
      emailResult,
      invoiceResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
