const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Order = require('./models/Order');
const User = require('./models/User');
const Product = require('./models/Product');
const { sendDeliveryConfirmationWithInvoice } = require('./services/emailNotificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sbf-florist');

async function simulateStatusUpdate() {
  try {
    console.log('🔄 Simulating order status update to "delivered"...');

    // Get an order that's not already delivered
    const order = await Order.findOne({ 
      status: { $ne: 'delivered' } 
    }).populate({
      path: 'items.product',
      select: 'title price images sku discount'
    });

    if (!order) {
      console.log('❌ No non-delivered orders found to test with');
      
      // Get any order for testing
      const anyOrder = await Order.findOne().populate({
        path: 'items.product',
        select: 'title price images sku discount'
      });
      
      if (!anyOrder) {
        console.log('❌ No orders found at all');
        process.exit(1);
      }
      
      console.log('📋 Using existing order for testing:', anyOrder.orderNumber);
      console.log('📊 Current status:', anyOrder.status);
      
      // Use this order but reset status for testing
      await Order.updateOne({ _id: anyOrder._id }, { status: 'being_made' });
      console.log('🔄 Reset order status to "being_made" for testing');
      
      // Re-fetch the order
      const updatedOrder = await Order.findById(anyOrder._id).populate({
        path: 'items.product',
        select: 'title price images sku discount'
      });
      
      return await simulateStatusChangeLogic(updatedOrder);
    }

    console.log(`🎯 Found order: ${order.orderNumber}`);
    console.log(`📊 Current status: ${order.status}`);
    
    return await simulateStatusChangeLogic(order);

  } catch (error) {
    console.error('❌ Error in simulation:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

async function simulateStatusChangeLogic(order) {
  try {
    // This simulates the exact logic from updateOrderStatus
    const status = 'delivered';
    const previousStatus = order.status;
    
    console.log('🔄 updateOrderStatus called for order ID:', order._id);
    console.log('🔄 New status:', status);
    console.log('📋 Order found:', order.orderNumber, 'Current status:', order.status);
    console.log('🔄 Status change:', previousStatus, '→', status);

    // Update the order status
    order.status = status;
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    const updatedOrder = await order.save();
    console.log('💾 Order saved successfully');

    // Check the delivery email condition
    console.log('🧪 Checking email condition...');
    console.log('  status === "delivered":', status === 'delivered');
    console.log('  previousStatus !== "delivered":', previousStatus !== 'delivered');
    console.log('  Overall condition:', status === 'delivered' && previousStatus !== 'delivered');

    // Send delivery confirmation email with invoice when order is delivered
    if (status === 'delivered' && previousStatus !== 'delivered') {
      console.log('🚚 Order delivered, sending delivery confirmation email with invoice...');
      console.log('📧 Previous status:', previousStatus, 'New status:', order.status);
      
      // Get customer details
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

        console.log('📤 Sending delivery confirmation email to:', customer.email);

        // Send delivery confirmation email with invoice
        const emailResult = await sendDeliveryConfirmationWithInvoice(deliveryNotificationData);
        
        console.log('📧 Email sending result:', emailResult);
        
        if (emailResult.success) {
          console.log('✅ Delivery confirmation email with invoice sent successfully to:', customer.email);
        } else {
          console.error('❌ Failed to send delivery confirmation email:', emailResult.error);
        }
      } else {
        console.warn('⚠️  No customer email found for delivery confirmation');
        if (customer) {
          console.log('Customer object keys:', Object.keys(customer));
          console.log('Customer email field:', customer.email);
        }
      }
    } else {
      console.log('📧 Email not sent - condition not met');
      console.log('  Reason: status was already delivered or other condition failed');
    }

    console.log('✅ Status update simulation completed');

  } catch (error) {
    console.error('❌ Error in status change logic:', error);
    console.error('Error stack:', error.stack);
  }
}

// Run the simulation
simulateStatusUpdate(); 