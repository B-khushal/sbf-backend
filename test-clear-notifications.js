const axios = require('axios');

async function clearAllNotifications() {
  try {
    console.log('🚀 Testing clear all notifications API...');
    
    // First, let's try without authentication to see if server is running
    const serverUrl = 'http://localhost:5000';
    
    console.log('🔍 Checking if server is running...');
    try {
      const response = await axios.get(`${serverUrl}/api/products`);
      console.log('✅ Server is running!');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Server is not running. Please start the server first with: npm start');
        return;
      }
      console.log('✅ Server is running (got expected auth error)');
    }
    
    // For testing, we need an admin token
    // You'll need to either:
    // 1. Login as admin through the frontend and copy the token from localStorage
    // 2. Or create a test admin login endpoint
    
    console.log('🔑 To clear all notifications, you need to:');
    console.log('1. Login as admin on the frontend (http://localhost:5173/admin)');
    console.log('2. Open browser dev tools > Application > Local Storage');
    console.log('3. Copy the "token" value');
    console.log('4. Run this command with your admin token:');
    console.log('');
    console.log('curl -X DELETE http://localhost:5000/api/notifications/admin/clear-all \\');
    console.log('  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \\');
    console.log('  -H "Content-Type: application/json"');
    console.log('');
    console.log('Or use this script with the token:');
    console.log('node test-clear-notifications.js YOUR_ADMIN_TOKEN_HERE');
    
    // If token is provided as command line argument
    const token = process.argv[2];
    if (token) {
      console.log('🔑 Using provided token...');
      
      const response = await axios.delete(`${serverUrl}/api/notifications/admin/clear-all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Response:', response.data);
      console.log(`🗑️ Deleted ${response.data.deletedCount} notifications out of ${response.data.countBefore} total`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('🔐 Authentication required. Please provide a valid admin token.');
    } else if (error.response?.status === 403) {
      console.log('🚫 Access denied. Admin privileges required.');
    }
  }
}

clearAllNotifications(); 