const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Order = require('../models/Order');

const run = async () => {
  try {
    await connectDB();
    const result = await Order.syncIndexes();

    console.log('External order indexes synchronized successfully');
    console.log(result);
    process.exit(0);
  } catch (error) {
    console.error('Failed to synchronize external order indexes:', error);
    process.exit(1);
  }
};

run();