const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the `server` directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Product = require('../models/Product');
const connectDB = require('../config/db');

const syncProductReviews = async () => {
  try {
    await connectDB();
    console.log('Database connected. Starting review sync...');

    const products = await Product.find({});
    let updatedCount = 0;

    for (const product of products) {
      const numReviews = product.reviews.length;
      const rating =
        numReviews > 0
          ? product.reviews.reduce((acc, item) => item.rating + acc, 0) / numReviews
          : 0;

      if (product.numReviews !== numReviews || product.rating !== rating) {
        product.numReviews = numReviews;
        product.rating = rating;
        await product.save();
        console.log(`Updated product: ${product.title}`);
        updatedCount++;
      }
    }

    console.log(`\nSync complete. ${updatedCount} products were updated.`);
    process.exit(0);
  } catch (error) {
    console.error('Error syncing product reviews:', error);
    process.exit(1);
  }
};

syncProductReviews(); 