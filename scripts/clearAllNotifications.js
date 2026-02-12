const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config();

// Use the same MongoDB connection string as your server
const MONGODB_URI = process.env.MONGODB_URI;

async function clearAllNotifications() {
  try {
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set!');
      console.log('');
      console.log('🔧 SOLUTIONS:');
      console.log('1. Create a .env file in the server directory with:');
      console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
      console.log('');
      console.log('2. Or set the environment variable directly:');
      console.log('   $env:MONGODB_URI="your-connection-string"; node scripts/clearAllNotifications.js');
      console.log('');
      console.log('3. Or use the API endpoint (requires admin login):');
      console.log('   DELETE http://localhost:5000/api/notifications/admin/clear-all');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('📍 Connection string:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      sslValidate: false, // Same config as your server
    });
    console.log('✅ Connected to MongoDB Atlas successfully');

    // Count existing notifications before deletion
    const countBefore = await Notification.countDocuments({});
    console.log(`📊 Found ${countBefore} notifications in the database`);

    if (countBefore === 0) {
      console.log('📭 No notifications to delete');
      await mongoose.disconnect();
      return;
    }

    // Ask for confirmation (in a real scenario, you'd want user input)
    console.log('⚠️  WARNING: This will DELETE ALL notifications permanently!');
    console.log('💡 Proceeding with deletion in 3 seconds... (Ctrl+C to cancel)');
    
    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete all notifications
    console.log('🗑️  Deleting all notifications...');
    const result = await Notification.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} notifications`);
    
    // Verify deletion
    const countAfter = await Notification.countDocuments({});
    console.log(`📊 Notifications remaining: ${countAfter}`);
    
    if (countAfter === 0) {
      console.log('🎉 All notifications have been successfully cleared!');
    } else {
      console.log(`⚠️  Warning: ${countAfter} notifications still remain`);
    }

  } catch (error) {
    console.error('❌ Error clearing notifications:', error.message);
    
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.log('');
      console.log('🔒 IP WHITELIST ISSUE:');
      console.log('1. Go to MongoDB Atlas Dashboard');
      console.log('2. Navigate to Network Access');
      console.log('3. Add your current IP address or use 0.0.0.0/0 (allow all)');
      console.log('4. Try running the script again');
    }
    
    if (error.message.includes('authentication')) {
      console.log('');
      console.log('🔑 AUTHENTICATION ISSUE:');
      console.log('1. Check your MongoDB Atlas username and password');
      console.log('2. Verify the connection string format');
      console.log('3. Ensure the database user has read/write permissions');
    }
    
    process.exit(1);
  } finally {
    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('👋 Database connection closed');
  }
}

// Check if running directly or being imported
if (require.main === module) {
  console.log('🚀 Starting notification cleanup script...');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('');
  clearAllNotifications();
}

module.exports = clearAllNotifications; 