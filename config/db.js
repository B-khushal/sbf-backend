const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use local MongoDB for testing if MONGODB_URI is not set
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-local';
    
    console.log('🔍 Attempting to connect to MongoDB...');
    console.log('🔗 MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    // ⚡ UPDATED: Modern MongoDB connection options (v6+ compatible)
    const connectionOptions = {
      // Connection pool settings
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain minimum 2 connections
      
      // Timeout settings
      serverSelectionTimeoutMS: 10000, // How long to try selecting a server
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take
      connectTimeoutMS: 10000, // How long to wait for initial connection
      
      // Retry settings
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // DNS and network settings
      family: 4, // Use IPv4, skip trying IPv6
      
      // Additional Atlas-specific settings for cloud connections
      ...(mongoURI.includes('mongodb+srv') ? {
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        ssl: true
      } : {})
    };

    // ⚡ FIXED: Remove deprecated options that cause deployment failures
    console.log('🔧 Using MongoDB connection options:', {
      maxPoolSize: connectionOptions.maxPoolSize,
      serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS,
      isAtlas: mongoURI.includes('mongodb+srv')
    });

    const conn = await mongoose.connect(mongoURI, connectionOptions);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Connection state: ${conn.connection.readyState}`);
    
    // ⚡ Set up connection event listeners for monitoring
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected successfully');
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔄 MongoDB connecting...');
    });

    // ⚡ PERFORMANCE: Optimize for production
    if (process.env.NODE_ENV === 'production') {
      mongoose.set('debug', false);
      mongoose.set('strictQuery', true);
    } else {
      mongoose.set('debug', true);
    }
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.error('❌ Error details:', error.name);
    
    // Provide helpful guidance for common connection issues
    if (error.message.includes('IP') || error.message.includes('allowlist') || error.message.includes('whitelist')) {
      console.log('\n🔧 IP WHITELIST SOLUTION:');
      console.log('1. Go to MongoDB Atlas Dashboard');
      console.log('2. Navigate to Network Access');
      console.log('3. Add 0.0.0.0/0 (Allow from anywhere) for Render deployment');
      console.log('4. Wait 2-3 minutes for changes to take effect');
      console.log('5. Redeploy your application');
    }
    
    if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.log('\n🔧 AUTHENTICATION SOLUTION:');
      console.log('1. Check your MONGODB_URI credentials in Render environment variables');
      console.log('2. Ensure username and password are correct');
      console.log('3. Check if special characters are URL encoded');
      console.log('4. Verify database user has proper permissions');
    }

    if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('\n🔧 CONNECTION TIMEOUT SOLUTION:');
      console.log('1. Check if MongoDB Atlas cluster is running');
      console.log('2. Verify the connection string is correct');
      console.log('3. Ensure network access is properly configured');
    }
    
    console.log('\n📋 Deployment Checklist:');
    console.log('✅ MONGODB_URI environment variable set');
    console.log('✅ IP address 0.0.0.0/0 added to Atlas whitelist');
    console.log('✅ Database user has readWrite permissions');
    console.log('✅ Connection string includes correct database name');
    
    // ⚡ CRITICAL: Exit process in production to trigger restart
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Exiting process to trigger restart...');
      process.exit(1);
    } else {
      console.log('⚠️ Continuing without database connection (development mode)');
    }
  }
};

module.exports = connectDB;
