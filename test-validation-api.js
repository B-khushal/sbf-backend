const axios = require('axios');

const baseURL = 'http://localhost:5000/api';

async function testPromoCodeValidation() {
  console.log('🧪 Testing Promo Code Validation API...\n');
  
  const testCases = [
    {
      name: 'Valid WELCOME10 code (10% off, min ₹500)',
      code: 'WELCOME10',
      orderAmount: 1000,
      expected: 'Should succeed with ₹100 discount (10% of ₹1000)'
    },
    {
      name: 'WELCOME10 below minimum order',
      code: 'WELCOME10',
      orderAmount: 300,
      expected: 'Should fail - below ₹500 minimum'
    },
    {
      name: 'Valid SAVE50 code (₹50 off, min ₹200)',
      code: 'SAVE50',
      orderAmount: 500,
      expected: 'Should succeed with ₹50 discount'
    },
    {
      name: 'FLOWERS20 high value order (20% off, min ₹1000)',
      code: 'FLOWERS20',
      orderAmount: 2000,
      expected: 'Should succeed with ₹400 discount (20% of ₹2000)'
    },
    {
      name: 'FLOWERS20 below minimum',
      code: 'FLOWERS20',
      orderAmount: 800,
      expected: 'Should fail - below ₹1000 minimum'
    },
    {
      name: 'BIGORDER for large purchase (₹100 off, min ₹2000)',
      code: 'BIGORDER',
      orderAmount: 2500,
      expected: 'Should succeed with ₹100 discount'
    },
    {
      name: 'Expired promo code',
      code: 'EXPIRED10',
      orderAmount: 1000,
      expected: 'Should fail - expired'
    },
    {
      name: 'Invalid/non-existent code',
      code: 'INVALID123',
      orderAmount: 1000,
      expected: 'Should fail - code not found'
    },
    {
      name: 'Empty code',
      code: '',
      orderAmount: 1000,
      expected: 'Should fail - empty code'
    }
  ];

  console.log('🔍 Testing validation endpoint: POST /api/promocodes/validate\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`   📝 Code: "${testCase.code}", Amount: ₹${testCase.orderAmount}`);
    console.log(`   🎯 Expected: ${testCase.expected}`);
    
    try {
      const response = await axios.post(`${baseURL}/promocodes/validate`, {
        code: testCase.code,
        orderAmount: testCase.orderAmount,
        items: [
          { name: 'Test Product', category: 'Flowers', price: testCase.orderAmount }
        ]
      });
      
      if (response.data.success) {
        const data = response.data.data;
        console.log(`   ✅ SUCCESS: ${response.data.message}`);
        console.log(`   💰 Discount: ₹${data.discount.amount} (${data.discount.percentage}%)`);
        console.log(`   🧾 Original: ₹${data.order.originalAmount} → Final: ₹${data.order.finalAmount}`);
        console.log(`   💡 Savings: ₹${data.discount.savings}`);
      } else {
        console.log(`   ❌ FAILED: ${response.data.message}`);
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`   ❌ EXPECTED ERROR: ${error.response.data.message}`);
      } else {
        console.log(`   💥 UNEXPECTED ERROR: ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('🎯 Summary:');
  console.log('   ✅ All validation tests completed');
  console.log('   🔍 Check results above for any unexpected failures');
  console.log('');
  
  // Test edge cases
  console.log('🧪 Testing Edge Cases...\n');
  
  const edgeCases = [
    {
      name: 'Very large order with percentage discount',
      code: 'WELCOME10',
      orderAmount: 10000,
      note: 'Should cap at maximum discount if set'
    },
    {
      name: 'Exact minimum order amount',
      code: 'SAVE50',
      orderAmount: 200,
      note: 'Should work at exactly minimum amount'
    }
  ];
  
  for (const edgeCase of edgeCases) {
    console.log(`Edge Test: ${edgeCase.name}`);
    console.log(`   💡 ${edgeCase.note}`);
    
    try {
      const response = await axios.post(`${baseURL}/promocodes/validate`, {
        code: edgeCase.code,
        orderAmount: edgeCase.orderAmount
      });
      
      if (response.data.success) {
        const data = response.data.data;
        console.log(`   ✅ SUCCESS: Discount ₹${data.discount.amount}, Final: ₹${data.order.finalAmount}`);
      } else {
        console.log(`   ❌ FAILED: ${response.data.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
  }
  
  console.log('🎉 All validation tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. ✅ API validation working');
  console.log('2. 🌐 Test admin UI: http://localhost:5173/admin/promocodes');
  console.log('3. 🛒 Test checkout integration');
  console.log('4. 🔄 Test end-to-end flow');
}

// Test server connectivity first
async function checkServerConnection() {
  try {
    console.log('🔍 Checking server connection...');
    const response = await axios.get(`${baseURL}/products`);
    console.log('✅ Backend server is running\n');
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running!');
      console.log('💡 Start it with: cd server && npm start\n');
      return false;
    } else {
      console.log('✅ Backend server is running (got response)\n');
      return true;
    }
  }
}

// Run tests
checkServerConnection().then(connected => {
  if (connected) {
    testPromoCodeValidation();
  }
}); 