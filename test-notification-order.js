const axios = require('axios');
require('dotenv').config();

// Test notification with NEW_ORDER data
const testOrderNotification = async () => {
  try {
    console.log('🧪 Testing NEW_ORDER notification...\n');

    // You need to replace this with an actual device token
    // You can get device tokens from your database or the mobile app
    const deviceToken = process.argv[2] || 'PASTE_YOUR_DEVICE_TOKEN_HERE';

    if (deviceToken === 'PASTE_YOUR_DEVICE_TOKEN_HERE') {
      console.error('❌ Error: Please provide a device token as an argument');
      console.log('\nUsage: node test-notification-order.js <device-token>');
      console.log('\nOr you can get all registered tokens using:');
      console.log('GET http://localhost:5000/api/device-tokens (with admin auth)\n');
      process.exit(1);
    }

    const port = process.env.PORT || 5000;
    const apiUrl = `http://localhost:${port}/api/device-tokens/test`;

    const payload = {
      token: deviceToken,
      title: "Test Order #123",
      body: "New order received - Testing sound",
      data: {
        type: "NEW_ORDER",
        title: "Test Order #123",
        body: "New order received - Testing sound",
        orderId: "test123",
        orderNumber: "123",
        customerName: "John Doe",
        amount: "500"
      }
    };

    console.log('📱 Sending notification to:', deviceToken.substring(0, 30) + '...');
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    console.log('\n⏳ Sending...\n');

    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ Notification sent successfully!');
      console.log('📨 Message ID:', response.data.data?.messageId);
      console.log('\n🔔 Check your device for the notification!\n');
    } else {
      console.error('❌ Failed to send notification');
      console.error('Error:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Error sending test notification:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data?.message);
      console.error('Error:', error.response.data?.error);
    } else {
      console.error(error.message);
    }
    console.log('\n💡 Make sure:');
    console.log('   1. The server is running (npm start)');
    console.log('   2. Firebase credentials are configured in .env');
    console.log('   3. The device token is valid and active\n');
  }
};

// Run the test
testOrderNotification();
