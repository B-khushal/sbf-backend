const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Order = require('./models/Order');
const Product = require('./models/Product');
const User = require('./models/User');
const { sendDeliveryConfirmationWithInvoice } = require('./services/emailNotificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sbf-florist');

async function debugDeliveryEmail() {
  try {
    console.log('🔍 Debugging delivery email flow...');

    // Get the most recent order
    const orders = await Order.find().sort({ createdAt: -1 }).limit(5);
    console.log(`📋 Found ${orders.length} recent orders`);

    if (orders.length === 0) {
      console.log('❌ No orders found to test with');
      process.exit(1);
    }

    // Test with the first order
    const order = orders[0];
    console.log(`🎯 Testing with order: ${order.orderNumber}`);
    console.log(`📊 Current status: ${order.status}`);
    console.log(`👤 User ID: ${order.user}`);

    // Get customer details
    const customer = await User.findById(order.user);
    console.log('👤 Customer lookup result:', customer ? 'Found' : 'Not found');
    
    if (!customer) {
      console.log('❌ Customer not found, cannot test email');
      process.exit(1);
    }

    console.log(`📧 Customer email: ${customer.email}`);
    console.log(`👤 Customer name: ${customer.name}`);

    if (!customer.email) {
      console.log('❌ Customer has no email address');
      process.exit(1);
    }

    // Populate product details
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name title price images sku discount'
      });

    console.log(`📦 Order has ${populatedOrder.items.length} items`);

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

    console.log('📤 Attempting to send delivery confirmation email...');

    // Send delivery confirmation email with invoice
    const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);
    
    console.log('📧 Email sending result:', JSON.stringify(emailResult, null, 2));
    
    if (emailResult.success) {
      console.log('✅ Delivery confirmation email sent successfully!');
    } else {
      console.error('❌ Failed to send delivery confirmation email:', emailResult.error);
    }

  } catch (error) {
    console.error('❌ Error in debugging:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

// Run the debug function
debugDeliveryEmail(); 