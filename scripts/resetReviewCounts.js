const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const Review = require('../models/Review');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      sslValidate: false,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Reset review counts and ratings based on actual Review collection
const resetReviewCounts = async () => {
  try {
    console.log('🔄 Starting review count reset...');
    
    // Get all products
    const products = await Product.find({});
    console.log(`📦 Found ${products.length} products to update`);
    
    let updatedCount = 0;
    
    for (const product of products) {
      // Get approved reviews for this product
      const reviews = await Review.find({ 
        product: product._id, 
        status: 'approved' 
      }).select('rating');
      
      let newRating = 0;
      let newNumReviews = 0;
      
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        newRating = totalRating / reviews.length;
        newNumReviews = reviews.length;
      }
      
      // Update only if values are different
      if (product.rating !== newRating || product.numReviews !== newNumReviews) {
        await Product.findByIdAndUpdate(product._id, {
          rating: newRating,
          numReviews: newNumReviews
        });
        
        console.log(`✅ Updated "${product.title}": ${product.numReviews} → ${newNumReviews} reviews, ${product.rating.toFixed(1)} → ${newRating.toFixed(1)} rating`);
        updatedCount++;
      }
    }
    
    console.log(`\n🎉 Reset complete! Updated ${updatedCount} products.`);
    console.log(`📊 Summary:`);
    console.log(`   - Total products: ${products.length}`);
    console.log(`   - Updated products: ${updatedCount}`);
    console.log(`   - Unchanged products: ${products.length - updatedCount}`);
    
  } catch (error) {
    console.error('❌ Error resetting review counts:', error);
  }
};

// Run the script
const runScript = async () => {
  await connectDB();
  await resetReviewCounts();
  await mongoose.connection.close();
  console.log('🔐 Database connection closed');
  process.exit(0);
};

runScript(); 