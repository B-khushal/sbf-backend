const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const { sendEmail } = require('../services/emailService');
const EmailLog = require('../models/EmailLog');

async function runTests() {
  try {
    console.log('🔗 Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    const testRecipient = '2006sbf@gmail.com';
    const emailTypes = ['order_confirmation', 'delivery_assigned', 'review_request', 'contact_form_reply'];

    console.log('\n--- 📧 Dispatching Test Emails ---');
    for (const type of emailTypes) {
      console.log(`Sending email type: [${type}] to <${testRecipient}>...`);
      const result = await sendEmail({
        to: testRecipient,
        subject: `🧪 Diagnostic Test - ${type}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <h2>Diagnostic Test: ${type}</h2>
            <p>This is a diagnostic email sent by the centralized email system verification script.</p>
            <p>If you receive this, the SMTP transporter and domain routing are configured correctly.</p>
            <hr>
            <p style="font-size: 11px; color: #888;">Spring Blossoms Florist System</p>
          </div>
        `,
        text: `Diagnostic Test for ${type}.`,
        type: type
      });

      if (result.success) {
        console.log(`✅ Success! Message ID: ${result.messageId}`);
      } else {
        console.log(`❌ Failed! Error: ${result.error}`);
      }
    }

    console.log('\n--- 📊 Verifying Mongoose Audit Logs ---');
    const logs = await EmailLog.find().sort({ timestamp: -1 }).limit(emailTypes.length);
    console.log(`Retrieved the last ${logs.length} database logs:`);
    
    logs.forEach((log, idx) => {
      console.log(`\nLog #${idx + 1}:`);
      console.log(`  - Sender:    ${log.sender}`);
      console.log(`  - Recipient: ${log.recipient}`);
      console.log(`  - Subject:   ${log.subject}`);
      console.log(`  - Type:      ${log.emailType}`);
      console.log(`  - Status:    ${log.status}`);
      console.log(`  - Response:  ${log.smtpResponse || log.errorMessage}`);
      console.log(`  - Time:      ${log.timestamp}`);
    });

  } catch (err) {
    console.error('❌ Diagnostic error occurred:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB.');
  }
}

runTests();
