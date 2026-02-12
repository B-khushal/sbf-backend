require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');

const fixApprovalStatuses = async () => {
  try {
    console.log('🔧 Starting approval status migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all products without approvalStatus field
    const productsWithoutApproval = await Product.find({ 
      approvalStatus: { $exists: false } 
    }).populate('user');

    console.log(`📊 Found ${productsWithoutApproval.length} products without approval status`);

    let adminApproved = 0;
    let vendorPending = 0;

    for (const product of productsWithoutApproval) {
      if (!product.user) {
        console.log(`⚠️  Product ${product._id} has no user, setting to approved`);
        product.approvalStatus = 'approved';
        await product.save();
        adminApproved++;
        continue;
      }

      if (product.user.role === 'admin') {
        // Admin products are auto-approved
        product.approvalStatus = 'approved';
        await product.save();
        console.log(`✅ Auto-approved admin product "${product.title}"`);
        adminApproved++;
      } else if (product.user.role === 'vendor') {
        // Vendor products need approval
        product.approvalStatus = 'pending';
        await product.save();
        console.log(`⏳ Set vendor product "${product.title}" to pending approval`);
        vendorPending++;
      } else {
        // Default to approved for safety
        product.approvalStatus = 'approved';
        await product.save();
        adminApproved++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Admin products approved: ${adminApproved}`);
    console.log(`   ⏳ Vendor products pending: ${vendorPending}`);
    console.log('✅ Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  fixApprovalStatuses();
}

module.exports = fixApprovalStatuses;
