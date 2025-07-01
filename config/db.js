const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use local MongoDB for testing if MONGODB_URI is not set
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-local';
    
    console.log('🔍 Attempting to connect to MongoDB...');
    console.log('🔗 MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Increase timeout for slower connections
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      // Only use SSL if it's a cloud connection
      ...(mongoURI.includes('mongodb+srv') ? {
        ssl: true,
      } : {})
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test the connection with a simple operation
    await mongoose.connection.db.admin().ping();
    console.log('✅ Database ping successful');
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // Provide specific guidance based on error type
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('\n🚨 IP WHITELIST ISSUE:');
      console.error('1. Go to MongoDB Atlas → Network Access');
      console.error('2. Add your current IP address to the whitelist');
      console.error('3. Wait 2-3 minutes for changes to take effect');
      console.error('4. Restart the server\n');
    } else if (error.message.includes('authentication')) {
      console.error('\n🚨 AUTHENTICATION ISSUE:');
      console.error('1. Check your username and password in MONGODB_URI');
      console.error('2. Ensure the database user has read/write permissions');
      console.error('3. Verify the database name is correct\n');
    }
    
    // For development, try connecting to local MongoDB
    if (process.env.NODE_ENV === 'development' && !process.env.MONGODB_URI) {
      try {
        console.log('🔄 Trying local MongoDB without authentication...');
        const conn = await mongoose.connect('mongodb://localhost:27017/sbf-local', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log(`✅ Connected to local MongoDB: ${conn.connection.host}`);
        console.log('⚠️ Using local MongoDB. Reviews will be saved locally.');
        return;
      } catch (localError) {
        console.error(`❌ Local MongoDB also failed: ${localError.message}`);
        console.error('\n💡 SOLUTIONS:');
        console.error('1. Install MongoDB locally, OR');
        console.error('2. Fix MongoDB Atlas connection (see above), OR');
        console.error('3. Contact your database administrator\n');
      }
    }
    
    console.error('❌ Could not connect to MongoDB. Please fix the connection and try again.');
    process.exit(1);
  }
};

module.exports = connectDB;
