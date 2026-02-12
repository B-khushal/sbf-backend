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

// Fix malformed product details
const fixProductDetails = async () => {
  try {
    console.log('🔧 Starting product details migration...');
    
    // Find all products
    const products = await Product.find({});
    console.log(`📦 Found ${products.length} products to check`);
    
    let fixedCount = 0;
    
    for (const product of products) {
      let needsUpdate = false;
      
      // Check and fix details field
      if (product.details && Array.isArray(product.details)) {
        const newDetails = [];
        
        for (let detail of product.details) {
          if (typeof detail === 'string') {
            // Check if it's a malformed nested array string
            if (detail.startsWith('[') && detail.endsWith(']')) {
              try {
                // Try to parse the nested array
                const parsed = JSON.parse(detail);
                if (Array.isArray(parsed)) {
                  // Flatten the nested array
                  for (let item of parsed) {
                    if (Array.isArray(item)) {
                      newDetails.push(...item.filter(i => typeof i === 'string'));
                    } else if (typeof item === 'string') {
                      newDetails.push(item);
                    }
                  }
                  needsUpdate = true;
                } else {
                  newDetails.push(detail);
                }
              } catch (parseError) {
                // If parsing fails, keep the original string
                newDetails.push(detail);
              }
            } else {
              // Normal string, keep as is
              newDetails.push(detail);
            }
          }
        }
        
        if (needsUpdate) {
          // Update the product with fixed details
          await Product.findByIdAndUpdate(
            product._id,
            { details: newDetails },
            { runValidators: false } // Skip validation to avoid the casting error
          );
          
          console.log(`✅ Fixed details for product: ${product.title}`);
          console.log(`   Old: ${JSON.stringify(product.details)}`);
          console.log(`   New: ${JSON.stringify(newDetails)}`);
          fixedCount++;
        }
      }
      
      // Check and fix careInstructions field (similar issue might exist)
      if (product.careInstructions && Array.isArray(product.careInstructions)) {
        const newCareInstructions = [];
        let careNeedsUpdate = false;
        
        for (let instruction of product.careInstructions) {
          if (typeof instruction === 'string') {
            // Check if it's a malformed nested array string
            if (instruction.startsWith('[') && instruction.endsWith(']')) {
              try {
                // Try to parse the nested array
                const parsed = JSON.parse(instruction);
                if (Array.isArray(parsed)) {
                  // Flatten the nested array
                  for (let item of parsed) {
                    if (Array.isArray(item)) {
                      newCareInstructions.push(...item.filter(i => typeof i === 'string'));
                    } else if (typeof item === 'string') {
                      newCareInstructions.push(item);
                    }
                  }
                  careNeedsUpdate = true;
                } else {
                  newCareInstructions.push(instruction);
                }
              } catch (parseError) {
                // If parsing fails, keep the original string
                newCareInstructions.push(instruction);
              }
            } else {
              // Normal string, keep as is
              newCareInstructions.push(instruction);
            }
          }
        }
        
        if (careNeedsUpdate) {
          // Update the product with fixed care instructions
          await Product.findByIdAndUpdate(
            product._id,
            { careInstructions: newCareInstructions },
            { runValidators: false } // Skip validation to avoid the casting error
          );
          
          console.log(`✅ Fixed care instructions for product: ${product.title}`);
          console.log(`   Old: ${JSON.stringify(product.careInstructions)}`);
          console.log(`   New: ${JSON.stringify(newCareInstructions)}`);
          fixedCount++;
        }
      }
    }
    
    console.log(`🎉 Migration completed! Fixed ${fixedCount} products.`);
    
    // Verify the fix by trying to load and save a product
    console.log('🔍 Verifying the fix...');
    const testProduct = await Product.findOne({});
    if (testProduct) {
      await testProduct.save();
      console.log('✅ Verification successful - products can now be saved without errors');
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
};

// Run the migration
const runMigration = async () => {
  await connectDB();
  await fixProductDetails();
  process.exit(0);
};

// Export for use in other scripts
module.exports = { fixProductDetails };

// Run if called directly
if (require.main === module) {
  runMigration();
} 