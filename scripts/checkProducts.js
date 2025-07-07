const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

const checkProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-local');
    console.log('✅ Connected to MongoDB');

    // Get all products
    const allProducts = await Product.find({});
    console.log(`📦 Total products in database: ${allProducts.length}`);

    // Check products by visibility
    const visibleProducts = await Product.find({ hidden: { $ne: true } });
    const hiddenProducts = await Product.find({ hidden: true });
    
    console.log(`👁️ Visible products: ${visibleProducts.length}`);
    console.log(`🙈 Hidden products: ${hiddenProducts.length}`);

    // Check products by discount
    const productsWithDiscount = await Product.find({ discount: { $gt: 0 } });
    const productsWithoutDiscount = await Product.find({ discount: { $lte: 0 } });
    
    console.log(`💰 Products with discount: ${productsWithDiscount.length}`);
    console.log(`💸 Products without discount: ${productsWithoutDiscount.length}`);

    // Check intersection
    const visibleWithDiscount = await Product.find({ 
      hidden: { $ne: true }, 
      discount: { $gt: 0 } 
    });
    const visibleWithoutDiscount = await Product.find({ 
      hidden: { $ne: true }, 
      discount: { $lte: 0 } 
    });
    
    console.log(`\n📊 BREAKDOWN:`);
    console.log(`✅ Visible products WITH discount: ${visibleWithDiscount.length}`);
    console.log(`✅ Visible products WITHOUT discount: ${visibleWithoutDiscount.length}`);
    console.log(`❌ Hidden products WITH discount: ${productsWithDiscount.length - visibleWithDiscount.length}`);
    console.log(`❌ Hidden products WITHOUT discount: ${productsWithoutDiscount.length - visibleWithoutDiscount.length}`);

    // Show some examples
    console.log(`\n📋 SAMPLE PRODUCTS:`);
    
    if (visibleWithDiscount.length > 0) {
      console.log(`\n✅ Visible with discount:`);
      visibleWithDiscount.slice(0, 3).forEach(p => {
        console.log(`   - ${p.title} (Discount: ${p.discount}%, Hidden: ${p.hidden})`);
      });
    }
    
    if (visibleWithoutDiscount.length > 0) {
      console.log(`\n✅ Visible without discount:`);
      visibleWithoutDiscount.slice(0, 3).forEach(p => {
        console.log(`   - ${p.title} (Discount: ${p.discount}%, Hidden: ${p.hidden})`);
      });
    }
    
    if (hiddenProducts.length > 0) {
      console.log(`\n🙈 Hidden products:`);
      hiddenProducts.slice(0, 3).forEach(p => {
        console.log(`   - ${p.title} (Discount: ${p.discount}%, Hidden: ${p.hidden})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking products:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the script
checkProducts(); 