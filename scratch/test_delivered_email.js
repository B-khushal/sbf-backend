require('dotenv').config();
const { sendEmail } = require('../services/emailService');

async function testDeliveredEmail() {
  const result = await sendEmail({
    to: '2006sbf@gmail.com', // test to our own email
    subject: '🧪 Test Delivered Email',
    type: 'delivered',
    html: '<p>Test Delivered Email Body</p>',
    text: 'Test Delivered Email Body'
  });
  console.log('Result:', JSON.stringify(result, null, 2));
}

testDeliveredEmail().catch(console.error).finally(() => process.exit());
