const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

async function createTestOrder() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-florist';
  console.log(`🔌 Connecting to database...`);
  
  try {
    await mongoose.connect(uri);
    console.log('✅ Database connected successfully');

    // 1. Resolve User
    const emails = ['khushlprasad242@gmail.com', 'khushalprasad242@gmail.com'];
    let user = null;
    
    for (const email of emails) {
      user = await User.findOne({ email: email });
      if (user) {
        console.log(`👤 Found existing user: ${user.email} (${user._id})`);
        break;
      }
    }
    
    if (!user) {
      console.log(`👤 Creating new user for khushlprasad242@gmail.com...`);
      user = await User.create({
        name: 'Khushal Prasad',
        email: 'khushlprasad242@gmail.com',
        phone: '9949683222',
        role: 'user',
        password: 'testPassword123'
      });
      console.log(`👤 User created successfully: ${user.email} (${user._id})`);
    }

    // 2. Find a Product to order
    const product = await Product.findOne({ countInStock: { $gt: 0 } });
    if (!product) {
      console.error('❌ No active products in database. Please add a product first.');
      process.exit(1);
    }
    console.log(`📦 Using product: ${product.title} (Price: ${product.price}, ID: ${product._id})`);

    // 3. Create the order
    // Generate a unique order number to avoid collision
    const orderNumber = `SBF-TEST-${Math.floor(100000 + Math.random() * 900000)}`;

    const orderData = {
      orderNumber,
      user: user._id,
      shippingDetails: {
        fullName: user.name,
        email: user.email,
        phone: user.phone || '9949683222',
        address: 'Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam',
        apartment: 'Door No. 12-2-786/A & B',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500028',
        deliveryDate: new Date(),
        timeSlot: 'Same-Day Delivery (09:00 AM - 09:00 PM)',
        notes: 'Test order created for production delivery verification'
      },
      items: [{
        product: product._id,
        productModel: 'Product',
        title: product.title,
        quantity: 1,
        price: product.price,
        finalPrice: product.price,
        image: product.images?.[0] || ''
      }],
      paymentDetails: {
        method: 'razorpay',
        razorpayPaymentId: 'pay_test_order_delivery',
        razorpayOrderId: 'order_test_razor'
      },
      totalAmount: product.price + 150,
      subtotal: product.price,
      deliveryCharge: 150,
      finalTotal: product.price + 150,
      currency: 'INR',
      status: 'received', // Ready to be marked as delivered
      stockUpdated: false
    };

    console.log('📝 Inserting order into database...');
    const order = await Order.create(orderData);
    console.log('\n===================================================');
    console.log('✅ TEST ORDER CREATED SUCCESSFULLY!');
    console.log('===================================================');
    console.log(`🆔 Order ID (Hex): ${order._id}`);
    console.log(`🔢 Order Number:   ${order.orderNumber}`);
    console.log(`📧 Customer:       ${user.email}`);
    console.log(`💰 Total Amount:    ₹${order.totalAmount}`);
    console.log(`📊 Current Status:  ${order.status}`);
    console.log('===================================================\n');
    console.log('💡 Use the Order ID above to test the "delivered" update in your production admin panel.');

  } catch (error) {
    console.error('❌ Failed to create test order:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

createTestOrder();
