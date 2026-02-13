const axios = require('axios');
require('dotenv').config();

// Test the test-by-id endpoint
const testNotificationById = async () => {
  try {
    console.log('🧪 Testing /api/device-tokens/test-by-id endpoint...\n');

    // First, get the admin token (replace with your actual admin token or login)
    const token = process.argv[2];
    
    if (!token) {
      console.error('❌ Error: Please provide an admin token as an argument');
      console.log('\nUsage: node test-notification-by-id.js <admin-token> [device-id]');
      console.log('\nYou can get your token from localStorage after logging in as admin\n');
      process.exit(1);
    }

    const deviceId = process.argv[3];
    
    // If no device ID provided, first fetch available devices
    if (!deviceId) {
      console.log('📱 Fetching admin devices first...\n');
      
      const devicesResponse = await axios.get('http://localhost:5000/api/device-tokens/admin-devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Admin devices:', JSON.stringify(devicesResponse.data, null, 2));
      
      if (devicesResponse.data.data && devicesResponse.data.data.length > 0) {
        const firstDevice = devicesResponse.data.data[0];
        console.log(`\n📱 Found ${devicesResponse.data.data.length} device(s)`);
        console.log(`\nTo test with first device, run:`);
        console.log(`node test-notification-by-id.js ${token} ${firstDevice.id}\n`);
      } else {
        console.log('\n⚠️  No admin devices registered yet.\n');
      }
      
      return;
    }

    // Test the notification endpoint
    console.log('📤 Sending test notification...\n');
    console.log('Device ID:', deviceId);
    
    const response = await axios.post(
      'http://localhost:5000/api/device-tokens/test-by-id',
      {
        deviceId: deviceId,
        title: '🧪 Test from Script',
        body: 'Testing push notification endpoint',
        data: {
          source: 'test_script',
          timestamp: new Date().toISOString()
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('\nFull headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
};

testNotificationById();
