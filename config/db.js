
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
      // Only use TLS if it's a cloud connection
      ...(mongoURI.includes('mongodb+srv') ? {
        tlsAllowInvalidCertificates: false,
        retryWrites: true,
        w: 'majority'
      } : {})
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // For development, try connecting without authentication
    if (process.env.NODE_ENV === 'development') {
      try {
        console.log('🔄 Trying local MongoDB without authentication...');
        const conn = await mongoose.connect('mongodb://localhost:27017/sbf-local', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log(`✅ Connected to local MongoDB: ${conn.connection.host}`);
        return;
      } catch (localError) {
        console.error(`❌ Local MongoDB also failed: ${localError.message}`);
      }
    }
    
    console.error('❌ Could not connect to MongoDB. Please ensure MongoDB is running or check your credentials.');
    process.exit(1);
  }
};

module.exports = connectDB;
