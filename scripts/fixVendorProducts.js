require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const User = require('../models/User');

const fixVendorProducts = async () => {
  try {
    console.log('🔧 Starting vendor products migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all products without a vendor field set
    const productsWithoutVendor = await Product.find({ 
      vendor: { $exists: false } 
    }).populate('user');

    console.log(`📊 Found ${productsWithoutVendor.length} products without vendor field`);

    let updated = 0;
    let skipped = 0;

    for (const product of productsWithoutVendor) {
      if (!product.user) {
        console.log(`⚠️  Product ${product._id} has no user, skipping`);
        skipped++;
        continue;
      }

      // Check if the user is a vendor
      if (product.user.role === 'vendor') {
        const vendor = await Vendor.findOne({ user: product.user._id });
        
        if (vendor) {
          product.vendor = vendor._id;
          await product.save();
          console.log(`✅ Updated product "${product.title}" with vendor ${vendor.storeName}`);
          updated++;
        } else {
          console.log(`⚠️  Product "${product.title}" has vendor user but no vendor profile`);
          skipped++;
        }
      } else {
        console.log(`⏭️  Product "${product.title}" is by admin, skipping`);
        skipped++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} products`);
    console.log(`   ⏭️  Skipped: ${skipped} products`);
    console.log('✅ Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  fixVendorProducts();
}

module.exports = fixVendorProducts;
