const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const migrateReviews = async () => {
  try {
    console.log('🚀 Starting review migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected');
    
    // Find all products with embedded reviews
    const productsWithReviews = await Product.find({
      reviews: { $exists: true, $ne: [] }
    });
    
    console.log(`📊 Found ${productsWithReviews.length} products with embedded reviews`);
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    // Process each product
    for (const product of productsWithReviews) {
      console.log(`\n🔄 Processing product: ${product.title}`);
      console.log(`   - Found ${product.reviews.length} embedded reviews`);
      
      // Process each embedded review
      for (const embeddedReview of product.reviews) {
        try {
          // Check if review already exists in new collection
          const existingReview = await Review.findOne({
            user: embeddedReview.user,
            product: product._id,
            createdAt: embeddedReview.createdAt
          });
          
          if (existingReview) {
            console.log(`   ⏭️  Review by ${embeddedReview.name} already migrated, skipping`);
            totalSkipped++;
            continue;
          }
          
          // Get user details for email
          const user = await User.findById(embeddedReview.user);
          if (!user) {
            console.log(`   ⚠️  User not found for review by ${embeddedReview.name}, skipping`);
            totalSkipped++;
            continue;
          }
          
          // Create new review document
          const newReview = new Review({
            user: embeddedReview.user,
            product: product._id,
            name: embeddedReview.name,
            email: user.email,
            rating: embeddedReview.rating,
            title: embeddedReview.comment.substring(0, 50) + '...', // Generate title from comment
            comment: embeddedReview.comment,
            isVerifiedPurchase: false, // Default for migrated reviews
            createdAt: embeddedReview.createdAt,
            updatedAt: embeddedReview.updatedAt || embeddedReview.createdAt
          });
          
          await newReview.save();
          console.log(`   ✅ Migrated review by ${embeddedReview.name}`);
          totalMigrated++;
          
        } catch (error) {
          console.log(`   ❌ Error migrating review by ${embeddedReview.name}:`, error.message);
          totalSkipped++;
        }
      }
      
      // Update product stats (keep existing stats for now)
      // The product will still show reviews via virtual populate
      console.log(`   📊 Product migration completed`);
    }
    
    console.log('\n🎉 Migration Summary:');
    console.log(`   ✅ Total reviews migrated: ${totalMigrated}`);
    console.log(`   ⏭️  Total reviews skipped: ${totalSkipped}`);
    console.log(`   📦 Total products processed: ${productsWithReviews.length}`);
    
    // Verify migration
    const totalNewReviews = await Review.countDocuments();
    console.log(`   🔍 Total reviews in new collection: ${totalNewReviews}`);
    
    console.log('\n✨ Migration completed successfully!');
    console.log('📝 Note: Embedded reviews are still in Product model for backward compatibility');
    console.log('   You can remove them later after verifying the migration worked correctly');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  migrateReviews();
}

module.exports = { migrateReviews }; 