// Simple email test without database dependency
const { sendDeliveryConfirmationWithInvoice } = require('./services/emailNotificationService');

async function testEmailOnly() {
  console.log('📧 Testing delivery email service directly...');
  
  // Create sample data that matches what the real system would use
  const sampleOrderData = {
    order: {
      _id: 'test123',
      orderNumber: 'SBF-2024-001',
      totalAmount: 1299,
      currency: 'INR',
      createdAt: new Date(),
      shippingDetails: {
        fullName: 'Test Customer',
        address: '123 Test Street',
        apartment: 'Apt 4B',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500001',
        phone: '+919876543210',
        deliveryDate: new Date(),
        timeSlot: '10:00 AM - 2:00 PM'
      },
      items: [
        {
          product: {
            name: 'Beautiful Rose Bouquet',
            title: 'Beautiful Rose Bouquet',
            sku: 'ROSE-001'
          },
          quantity: 1,
          price: 799,
          finalPrice: 699
        },
        {
          product: {
            name: 'Chocolate Box',
            title: 'Premium Chocolate Box',
            sku: 'CHOC-001'
          },
          quantity: 1,
          price: 600,
          finalPrice: 600
        }
      ],
      paymentDetails: {
        method: 'razorpay',
        paymentId: 'pay_test123'
      }
    },
    customer: {
      name: 'Test Customer',
      email: 'khushalprasad242@gmail.com', // Test delivery email
      phone: '+919876543210'
    }
  };

  try {
    console.log('📤 Sending test delivery confirmation email...');
    console.log('📧 To:', sampleOrderData.customer.email);
    
    const result = await sendDeliveryConfirmationWithInvoice(sampleOrderData);
    
    console.log('\n📊 Email Test Results:');
    console.log('====================');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ Email failed to send');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

console.log('🧪 Starting email service test...');
testEmailOnly(); 