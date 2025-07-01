const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  try {
    console.log('🔍 Attempting to connect to MongoDB...');
    
    // Get MongoDB URI from environment variables
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    console.log(`🔗 MongoDB URI: ${mongoURI.replace(/\/\/.*@/, '//**:**@')}`);

    // ⚡ PRODUCTION OPTIMIZED: MongoDB connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      keepAlive: true,
      keepAliveInitialDelay: 300000,
      retryWrites: true,
      w: 'majority',
      wtimeout: 2500,
      autoIndex: process.env.NODE_ENV !== 'production' // Disable auto-indexing in production
    };

    // Connect with optimized options
    const conn = await mongoose.connect(mongoURI, options);

    // Log successful connection
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`🏢 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`📊 Port: ${conn.connection.port}`);
    
    // Log connection state
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      4: 'uninitialized'
    };
    console.log(`🔌 Connection State: ${states[state]}`);

    // Set up connection error handler
    mongoose.connection.on('error', err => {
      console.error('❌ MongoDB connection error:', err);
      logConnectionError(err);
    });

    // Set up disconnection handler
    mongoose.connection.on('disconnected', () => {
      console.log('❌ MongoDB disconnected');
      // Attempt to reconnect
      setTimeout(connectDB, 5000);
    });

    // Handle process termination
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return conn;

  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    logConnectionError(error);
    
    // In production, we want to retry connection
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
    
    process.exit(1);
  }
};

// Helper function to log detailed connection errors
const logConnectionError = (error) => {
  console.error('📋 Connection Error Details:', {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongoVersion: mongoose.version
  });
};

// Cleanup function for graceful shutdown
const cleanup = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during MongoDB cleanup:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
