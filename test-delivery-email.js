const dotenv = require('dotenv');
dotenv.config();

const { sendDeliveryConfirmationWithInvoice } = require('./services/emailNotificationService');

// Test delivery email function
async function testDeliveryEmail() {
  console.log('🧪 Testing delivery email functionality...');
  
  // Mock order data for testing
  const testOrderData = {
    order: {
      orderNumber: 'TEST-123',
      totalAmount: 2500,
      currency: 'INR',
      items: [
        {
          product: {
            name: 'Rose Bouquet',
            title: 'Beautiful Rose Bouquet',
            sku: 'RB001'
          },
          quantity: 1,
          price: 2500,
          finalPrice: 2500
        }
      ],
      shippingDetails: {
        fullName: 'Test Customer',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '123456',
        phone: '9876543210',
        deliveryDate: new Date()
      }
    },
    customer: {
      name: 'Test Customer',
      email: '2006sbf@gmail.com', // Using business email for testing
      phone: '9876543210'
    }
  };

  try {
    console.log('📤 Sending test delivery email...');
    const result = await sendDeliveryConfirmationWithInvoice(testOrderData);
    
    console.log('📊 Test Result:');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('✅ Message ID:', result.messageId);
    } else {
      console.log('❌ Error:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('💥 Test failed with exception:', error.message);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
testDeliveryEmail()
  .then(result => {
    console.log('\n📋 Final test result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  }); 