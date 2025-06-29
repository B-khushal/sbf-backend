const http = require('http');

// Test if server is running
function testServerHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      console.log('✅ Server is running on port 5000');
      console.log('📡 Status:', res.statusCode);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('📡 Response:', data);
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.log('❌ Server is NOT running on port 5000');
      console.log('❌ Error:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server request timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test review API endpoint
function testReviewAPI() {
  return new Promise((resolve, reject) => {
    const testReview = {
      rating: 5,
      title: 'Test Review Title',
      comment: 'This is a test review comment that is long enough to meet validation requirements.'
    };

    const postData = JSON.stringify(testReview);
    const productId = '507f1f77bcf86cd799439011';

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/products/${productId}/reviews`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      console.log('📡 Review API Status:', res.statusCode);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('📡 Review API Response:', data);
        resolve(true);
      });
    });

    req.on('error', (error) => {
      console.log('❌ Review API Error:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Review API request timed out');
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing SBF Server...\n');
  
  const serverRunning = await testServerHealth();
  
  if (serverRunning) {
    console.log('\n🧪 Testing Review API...\n');
    await testReviewAPI();
  } else {
    console.log('\n❌ Cannot test Review API because server is not running');
    console.log('\n💡 To start the server, run: npm start');
  }
}

runTests(); 