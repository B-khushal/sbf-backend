const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const { sendOrderNotificationToAdmins, sendToAllAdmins } = require('../services/fcmService');

async function triggerTestFcmOrder() {
  console.log('🚀 Starting Test FCM Order creation and notification dispatch...');

  try {
    // 1. Resolve User
    const emails = ['khushlprasad242@gmail.com', 'admin@sbflorist.in', 'test@sbflorist.in'];
    let user = null;
    
    for (const email of emails) {
      user = await User.findOne({ email: email });
      if (user) break;
    }
    
    if (!user) {
      user = await User.findOne({});
    }

    const userName = user ? user.name : 'Test Customer';
    const userEmail = user ? user.email : 'test@sbflorist.in';
    const userId = user ? user._id : 'user_test_123';

    // 2. Find a Product to order
    let product = await Product.findOne({ isAvailable: true });
    if (!product) {
      product = await Product.findOne({});
    }

    const productTitle = product ? (product.title || product.name) : 'Red Rose Bouquet';
    const productPrice = product ? (product.price || 499) : 499;
    const productId = product ? product._id : 'prod_test_123';

    // 3. Generate Order Number
    const orderNumber = `ORD-TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const totalAmount = productPrice + 150;

    const orderData = {
      orderNumber,
      user: userId,
      shippingDetails: {
        fullName: userName,
        email: userEmail,
        phone: '9949683222',
        address: 'Spring Blossoms Test Location, Mehdipatnam',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500028',
        deliveryDate: new Date(),
        timeSlot: 'Same-Day Delivery'
      },
      items: [{
        product: productId,
        productModel: 'Product',
        title: productTitle,
        quantity: 1,
        price: productPrice,
        finalPrice: productPrice,
        image: product ? (product.images?.[0] || '') : ''
      }],
      paymentDetails: {
        method: 'razorpay',
        razorpayPaymentId: 'pay_test_fcm_123',
        razorpayOrderId: 'order_test_fcm_123'
      },
      totalAmount: totalAmount,
      subtotal: productPrice,
      deliveryCharge: 150,
      finalTotal: totalAmount,
      currency: 'INR',
      status: 'order_placed',
      stockUpdated: false
    };

    console.log(`📝 Creating order #${orderNumber} for ₹${totalAmount}...`);
    const order = await Order.create(orderData);
    console.log(`✅ Order #${order.orderNumber} created in database with ID: ${order._id}`);

    // 4. Trigger FCM Notification to all Admin Devices
    console.log('📱 Dispatching FCM push notification to admin devices...');
    const fcmResult = await sendOrderNotificationToAdmins({
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: userName,
      totalAmount: totalAmount
    });

    console.log('\n===================================================');
    console.log('🎉 TEST ORDER & FCM NOTIFICATION RESULTS');
    console.log('===================================================');
    console.log(`🆔 Order ID:        ${order._id}`);
    console.log(`🔢 Order Number:    ${order.orderNumber}`);
    console.log(`👤 Customer Name:   ${userName}`);
    console.log(`💰 Total Amount:     ₹${totalAmount}`);
    console.log(`📱 FCM Status:      ${fcmResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (fcmResult.error) console.log(`⚠️  FCM Error:       ${fcmResult.error}`);
    if (fcmResult.totalTokens !== undefined) {
      console.log(`📊 Sent to:         ${fcmResult.successCount}/${fcmResult.totalTokens} active device token(s)`);
    }
    console.log('===================================================\n');

  } catch (error) {
    console.error('❌ Error creating test FCM order:', error);
  } finally {
    const prisma = require('../config/prisma');
    if (prisma && prisma.$disconnect) {
      await prisma.$disconnect();
    }
    process.exit(0);
  }
}

triggerTestFcmOrder();
