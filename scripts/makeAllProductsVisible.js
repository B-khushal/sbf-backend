const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

const makeAllProductsVisible = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-local');
    console.log('✅ Connected to MongoDB');

    // Get all products
    const allProducts = await Product.find({});
    console.log(`📦 Total products in database: ${allProducts.length}`);

    // Check current visibility status
    const hiddenProducts = await Product.find({ hidden: true });
    const visibleProducts = await Product.find({ hidden: { $ne: true } });
    
    console.log(`👁️ Currently visible products: ${visibleProducts.length}`);
    console.log(`🙈 Currently hidden products: ${hiddenProducts.length}`);

    if (hiddenProducts.length === 0) {
      console.log('✅ All products are already visible!');
      return;
    }

    // Make all products visible
    const result = await Product.updateMany(
      { hidden: true },
      { $set: { hidden: false } }
    );

    console.log(`✅ Made ${result.modifiedCount} products visible`);

    // Verify the change
    const updatedHiddenProducts = await Product.find({ hidden: true });
    const updatedVisibleProducts = await Product.find({ hidden: { $ne: true } });
    
    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`👁️ Visible products: ${updatedVisibleProducts.length}`);
    console.log(`🙈 Hidden products: ${updatedHiddenProducts.length}`);

    // Show some examples of products that were made visible
    if (hiddenProducts.length > 0) {
      console.log(`\n📋 PRODUCTS MADE VISIBLE:`);
      hiddenProducts.slice(0, 5).forEach(p => {
        console.log(`   - ${p.title} (Category: ${p.category})`);
      });
      if (hiddenProducts.length > 5) {
        console.log(`   ... and ${hiddenProducts.length - 5} more products`);
      }
    }

  } catch (error) {
    console.error('❌ Error making products visible:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the script
makeAllProductsVisible(); 