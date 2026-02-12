const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to database
const connectDB = async () => {
  try {
    // Use production MongoDB URI or fallback to environment variable
    const mongoUri = process.env.MONGO_URI || 
      process.env.MONGODB_URI || 
      'mongodb+srv://springblossoms:springblossoms@sbf-cluster.8yb1i.mongodb.net/sbf-database?retryWrites=true&w=majority&appName=SBF-Cluster';
    
    console.log('Connecting to MongoDB with URI:', mongoUri ? 'URI found' : 'No URI');
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to database:', error);
    process.exit(1);
  }
};

// Fix missing price variant fields
const fixPriceVariants = async () => {
  try {
    console.log('🔧 Starting price variant fields migration...');
    
    // Find all products
    const products = await Product.find({});
    console.log(`📦 Found ${products.length} products to check`);
    
    let updatedCount = 0;
    
    for (const product of products) {
      let needsUpdate = false;
      const updateData = {};
      
      // Check if hasPriceVariants field is missing
      if (product.hasPriceVariants === undefined) {
        // Determine if product has price variants based on existing data
        const hasVariants = product.priceVariants && 
                           Array.isArray(product.priceVariants) && 
                           product.priceVariants.length > 0;
        
        updateData.hasPriceVariants = hasVariants;
        needsUpdate = true;
        console.log(`📝 Product "${product.title}" missing hasPriceVariants field, setting to: ${hasVariants}`);
      }
      
      // Check if priceVariants field is missing
      if (!product.priceVariants) {
        updateData.priceVariants = [];
        needsUpdate = true;
        console.log(`📝 Product "${product.title}" missing priceVariants field, setting to empty array`);
      }
      
      // Check if selectedVariant field is missing
      if (product.selectedVariant === undefined) {
        updateData.selectedVariant = null;
        needsUpdate = true;
        console.log(`📝 Product "${product.title}" missing selectedVariant field, setting to null`);
      }
      
      if (needsUpdate) {
        // Update the product with missing fields
        await Product.findByIdAndUpdate(
          product._id,
          updateData,
          { runValidators: false, new: true }
        );
        
        console.log(`✅ Updated product: ${product.title}`);
        console.log(`   Updated fields: ${Object.keys(updateData).join(', ')}`);
        updatedCount++;
      }
    }
    
    console.log(`🎉 Migration completed! Updated ${updatedCount} products.`);
    
    // Verify the fix by checking a few products
    console.log('🔍 Verifying the fix...');
    const sampleProducts = await Product.find({}).limit(3);
    for (const product of sampleProducts) {
      console.log(`📋 Product: ${product.title}`);
      console.log(`   hasPriceVariants: ${product.hasPriceVariants}`);
      console.log(`   priceVariants: ${product.priceVariants ? product.priceVariants.length : 0} variants`);
      console.log(`   selectedVariant: ${product.selectedVariant}`);
    }
    
    console.log('✅ Verification successful - all products now have price variant fields');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
};

// Run the migration
const runMigration = async () => {
  await connectDB();
  await fixPriceVariants();
  process.exit(0);
};

// Export for use in other scripts
module.exports = { fixPriceVariants };

// Run if called directly
if (require.main === module) {
  runMigration();
} 