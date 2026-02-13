const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB and retrieve device tokens
const getDeviceTokens = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB\n');

    // Import DeviceToken model
    const DeviceToken = require('./models/DeviceToken');

    // Get all active tokens
    const tokens = await DeviceToken.find({ isActive: true })
      .sort({ lastUsed: -1 })
      .limit(10);

    if (tokens.length === 0) {
      console.log('❌ No active device tokens found in database');
      console.log('\n💡 To register a device token:');
      console.log('   POST /api/device-tokens/register');
      console.log('   Body: { "token": "your-fcm-token", "userId": "user-id" }\n');
    } else {
      console.log(`📱 Found ${tokens.length} active device token(s):\n`);
      tokens.forEach((token, index) => {
        console.log(`${index + 1}. Token: ${token.token.substring(0, 50)}...`);
        console.log(`   User: ${token.userId || 'Anonymous'}`);
        console.log(`   Device: ${token.deviceInfo?.platform || 'Unknown'}`);
        console.log(`   Last Used: ${token.lastUsed || 'Never'}`);
        console.log(`   Created: ${token.createdAt}`);
        console.log('');
      });

      console.log('🧪 To send a test notification, use:');
      console.log(`   node test-notification-order.js "${tokens[0].token}"\n`);
    }

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the script
getDeviceTokens();
