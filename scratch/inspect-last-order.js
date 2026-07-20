const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://khushalprasad242:ddkka2006@cluster0.qxae3.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function queryLastOrder() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');
    
    const Order = require('../models/Order');
    const order = await Order.findOne().sort({ createdAt: -1 });
    
    if (order) {
      console.log('--- LATEST ORDER ---');
      console.log('Order Number:', order.orderNumber);
      console.log('Created At:', order.createdAt);
      console.log('shippingDetails:', JSON.stringify(order.shippingDetails, null, 2));
      console.log('giftDetails:', JSON.stringify(order.giftDetails, null, 2));
    } else {
      console.log('No orders found.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

queryLastOrder();
