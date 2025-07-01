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
      // ⚡ PERFORMANCE OPTIMIZATIONS
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
      // Connection optimization
      ...(mongoURI.includes('mongodb+srv') ? {
        ssl: true,
        retryWrites: true,
        w: 'majority',
      } : {})
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // ⚡ Set up connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // ⚡ PERFORMANCE: Enable query result caching
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    
    // Provide helpful guidance for common connection issues
    if (error.message.includes('IP')) {
      console.log('\n🔧 SOLUTION:');
      console.log('1. Go to MongoDB Atlas Dashboard');
      console.log('2. Navigate to Network Access');
      console.log('3. Add your current IP address');
      console.log('4. Or temporarily add 0.0.0.0/0 for testing');
      console.log('5. Wait 2-3 minutes for changes to take effect');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n🔧 SOLUTION:');
      console.log('1. Check your MONGODB_URI credentials');
      console.log('2. Ensure username and password are correct');
      console.log('3. Check if special characters are URL encoded');
    }
    
    console.log('\n📋 For immediate testing, you can:');
    console.log('- Install MongoDB locally');
    console.log('- Use a local connection string');
    console.log('- The app will fallback to local MongoDB');
    
    // Exit the process for production, continue for development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️ Continuing without database connection (development mode)');
    }
  }
};

module.exports = connectDB;
