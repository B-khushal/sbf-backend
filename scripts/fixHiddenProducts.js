const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

const fixHiddenProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all hidden products
    const hiddenProducts = await Product.find({ hidden: true });
    console.log(`📦 Found ${hiddenProducts.length} hidden products`);

    if (hiddenProducts.length === 0) {
      console.log('✅ No hidden products found. All products are already visible.');
      return;
    }

    // Update all hidden products to be visible (except those that should remain hidden)
    const result = await Product.updateMany(
      { hidden: true },
      { hidden: false }
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} products to be visible`);
    console.log('📋 Updated products:');
    
    // Show the titles of updated products
    for (const product of hiddenProducts) {
      console.log(`   - ${product.title} (ID: ${product._id})`);
    }

  } catch (error) {
    console.error('❌ Error fixing hidden products:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the script
fixHiddenProducts(); 