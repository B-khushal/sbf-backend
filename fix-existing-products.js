// Script to check and fix existing products missing price variant fields
const mongoose = require('mongoose');
const Product = require('./models/Product');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sbf-florist', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixExistingProducts() {
  try {
    console.log('🔍 Checking existing products for price variant fields...\n');

    // Find all products
    const products = await Product.find({});
    console.log(`📊 Found ${products.length} total products`);

    let productsWithPriceVariants = 0;
    let productsMissingFields = 0;
    let productsFixed = 0;

    for (const product of products) {
      console.log(`\n🔍 Checking product: ${product.title} (ID: ${product._id})`);
      
      // Check if product has price variant fields
      const hasPriceVariantsField = product.hasOwnProperty('hasPriceVariants');
      const hasPriceVariantsArray = product.hasOwnProperty('priceVariants');
      
      console.log(`   hasPriceVariants field: ${hasPriceVariantsField}`);
      console.log(`   priceVariants field: ${hasPriceVariantsArray}`);
      
      if (hasPriceVariantsField && hasPriceVariantsArray) {
        console.log(`   ✅ Product has both fields`);
        if (product.hasPriceVariants) {
          productsWithPriceVariants++;
          console.log(`   📊 Price variants count: ${product.priceVariants.length}`);
          product.priceVariants.forEach((variant, index) => {
            console.log(`      Variant ${index + 1}: ${variant.label} - ₹${variant.price} (Stock: ${variant.stock})`);
          });
        }
      } else {
        console.log(`   ❌ Product missing price variant fields`);
        productsMissingFields++;
        
        // Fix the product by adding missing fields
        const updateData = {};
        if (!hasPriceVariantsField) {
          updateData.hasPriceVariants = false;
        }
        if (!hasPriceVariantsArray) {
          updateData.priceVariants = [];
        }
        
        if (Object.keys(updateData).length > 0) {
          console.log(`   🔧 Adding missing fields:`, updateData);
          await Product.findByIdAndUpdate(product._id, updateData);
          productsFixed++;
          console.log(`   ✅ Product fixed`);
        }
      }
    }

    console.log('\n📋 Summary:');
    console.log(`   Total products: ${products.length}`);
    console.log(`   Products with price variants: ${productsWithPriceVariants}`);
    console.log(`   Products missing fields: ${productsMissingFields}`);
    console.log(`   Products fixed: ${productsFixed}`);

    // Check the specific product mentioned
    console.log('\n🔍 Checking specific product: 686cf9f3e6e7111a0418c355');
    const specificProduct = await Product.findById('686cf9f3e6e7111a0418c355');
    if (specificProduct) {
      console.log(`   Title: ${specificProduct.title}`);
      console.log(`   hasPriceVariants: ${specificProduct.hasPriceVariants}`);
      console.log(`   priceVariants: ${JSON.stringify(specificProduct.priceVariants)}`);
      
      // If it's missing fields, fix it
      if (!specificProduct.hasOwnProperty('hasPriceVariants') || !specificProduct.hasOwnProperty('priceVariants')) {
        console.log('   🔧 Fixing specific product...');
        await Product.findByIdAndUpdate(specificProduct._id, {
          hasPriceVariants: false,
          priceVariants: []
        });
        console.log('   ✅ Specific product fixed');
      }
    } else {
      console.log('   ❌ Specific product not found');
    }

    console.log('\n🎉 Product check and fix completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the fix
fixExistingProducts(); 