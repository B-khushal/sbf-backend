const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Test MongoDB connection
const testConnection = async () => {
  try {
    // Use local MongoDB for testing if MONGODB_URI is not set
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-test';
    
    console.log('🔍 Testing MongoDB connection...');
    console.log('🔗 MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@'));
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test Review model
    const Review = require('./models/Review');
    const reviewCount = await Review.countDocuments();
    console.log(`📋 Existing reviews in database: ${reviewCount}`);
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Test review creation
const testReviewCreation = async () => {
  try {
    const Review = require('./models/Review');
    const User = require('./models/User');
    const Product = require('./models/Product');
    
    // Check if we have test data
    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();
    
    console.log(`👥 Users in database: ${userCount}`);
    console.log(`📦 Products in database: ${productCount}`);
    
    if (userCount === 0 || productCount === 0) {
      console.log('⚠️ No users or products found. Please ensure you have test data.');
      return;
    }
    
    // Get a test user and product
    const testUser = await User.findOne();
    const testProduct = await Product.findOne();
    
    console.log(`🧪 Testing with user: ${testUser.name} and product: ${testProduct.title}`);
    
    // Create a test review
    const testReview = new Review({
      user: testUser._id,
      product: testProduct._id,
      name: testUser.name,
      email: testUser.email,
      rating: 5,
      title: 'Test Review',
      comment: 'This is a test review to verify the system is working',
      isVerifiedPurchase: false,
    });
    
    await testReview.save();
    console.log('✅ Test review created successfully!');
    console.log('📋 Review ID:', testReview._id);
    
    // Clean up test review
    await Review.findByIdAndDelete(testReview._id);
    console.log('🧹 Test review cleaned up');
    
  } catch (error) {
    console.error('❌ Review creation test failed:', error);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting Review System Tests...\n');
  
  await testConnection();
  await testReviewCreation();
  
  console.log('\n✅ All tests completed!');
  process.exit(0);
};

runTests(); 