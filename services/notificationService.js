const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Initialize services
let emailTransporter = null;
let twilioClient = null;

// Configuration - these should be in environment variables
const EMAIL_CONFIG = {
  service: 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};

// Initialize email service
const initEmailService = () => {
  try {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('Email credentials not configured. Email notifications will be disabled.');
      return null;
    }
    
    emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
    console.log('Email service initialized successfully');
    return emailTransporter;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    return null;
  }
};

// Initialize Twilio service
const initTwilioService = () => {
  try {
    if (!TWILIO_CONFIG.accountSid || !TWILIO_CONFIG.authToken || !TWILIO_CONFIG.phoneNumber) {
      console.warn('Twilio credentials not configured. SMS and WhatsApp notifications will be disabled.');
      return null;
    }
    
    twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
    console.log('Twilio service initialized successfully');
    return twilioClient;
  } catch (error) {
    console.error('Failed to initialize Twilio service:', error);
    return null;
  }
};

// Format currency for display
const formatCurrency = (amount, currency = 'INR') => {
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };
  
  return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
};

// Format date for display
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Generate email template
const generateOrderConfirmationEmail = (orderData) => {
  const { order, customer, items } = orderData;
  
  const itemsList = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        ${item.product.name || item.product.title}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        ${formatCurrency(item.finalPrice || item.price, order.currency)}
      </td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - SBF</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .order-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { background: #f3f4f6; padding: 12px; text-align: left; }
        .table td { padding: 10px; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; color: #4f46e5; }
        .footer { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Confirmed!</h1>
          <p>Thank you for your order, ${customer.name}!</p>
        </div>
        
        <div class="content">
          <div class="order-details">
            <h2>Order Details</h2>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Order Date:</strong> ${formatDate(order.createdAt)}</p>
            <p><strong>Delivery Date:</strong> ${formatDate(order.shippingDetails.deliveryDate)}</p>
            <p><strong>Time Slot:</strong> ${order.shippingDetails.timeSlot}</p>
            
            <h3>Items Ordered:</h3>
            <table class="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
                <tr>
                  <td colspan="2" style="padding: 15px; font-weight: bold;">Total Amount:</td>
                  <td style="padding: 15px; text-align: right;" class="total">
                    ${formatCurrency(order.totalAmount, order.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
            
            <h3>Delivery Address:</h3>
            <p>
              ${order.shippingDetails.fullName}<br>
              ${order.shippingDetails.address}<br>
              ${order.shippingDetails.apartment ? order.shippingDetails.apartment + '<br>' : ''}
              ${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}<br>
              Phone: ${order.shippingDetails.phone}
            </p>
            
            ${order.shippingDetails.notes ? `<p><strong>Special Instructions:</strong> ${order.shippingDetails.notes}</p>` : ''}
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for choosing SBF!</p>
          <p>If you have any questions, please contact us at support@sbf.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate SMS template
const generateOrderConfirmationSMS = (orderData) => {
  const { order, customer } = orderData;
  
  return `🎉 SBF Order Confirmed!

Hi ${customer.name},
Your order #${order.orderNumber} has been confirmed.

Total: ${formatCurrency(order.totalAmount, order.currency)}
Delivery: ${formatDate(order.shippingDetails.deliveryDate)}
Time: ${order.shippingDetails.timeSlot}

We'll keep you updated on your order status.

Thank you for choosing SBF!`;
};

// Generate WhatsApp template
const generateOrderConfirmationWhatsApp = (orderData) => {
  const { order, customer, items } = orderData;
  
  const itemsList = items.map(item => 
    `• ${item.product.name || item.product.title} (Qty: ${item.quantity}) - ${formatCurrency(item.finalPrice || item.price, order.currency)}`
  ).join('\n');
  
  return `🎉 *SBF Order Confirmation*

Hi ${customer.name}! 👋

Your order has been successfully confirmed!

*Order Details:*
📦 Order Number: *${order.orderNumber}*
📅 Order Date: ${formatDate(order.createdAt)}
🚚 Delivery Date: *${formatDate(order.shippingDetails.deliveryDate)}*
⏰ Time Slot: ${order.shippingDetails.timeSlot}

*Items Ordered:*
${itemsList}

*Total Amount: ${formatCurrency(order.totalAmount, order.currency)}*

*Delivery Address:*
${order.shippingDetails.fullName}
${order.shippingDetails.address}
${order.shippingDetails.apartment ? order.shippingDetails.apartment + '\n' : ''}${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}
📞 ${order.shippingDetails.phone}

${order.shippingDetails.notes ? `*Special Instructions:* ${order.shippingDetails.notes}\n` : ''}
We'll keep you updated on your order status. Thank you for choosing SBF! 🙏

Need help? Reply to this message or call us.`;
};

// Send Email Notification
const sendEmailNotification = async (orderData) => {
  try {
    if (!emailTransporter) {
      console.log('Email service not available, skipping email notification');
      return { success: false, error: 'Email service not configured' };
    }

    const { customer, order } = orderData;
    
    const mailOptions = {
      from: {
        name: 'SBF Store',
        address: EMAIL_CONFIG.auth.user
      },
      to: customer.email,
      subject: `Order Confirmation - ${order.orderNumber} | SBF`,
      html: generateOrderConfirmationEmail(orderData),
      text: `Order Confirmation\n\nHi ${customer.name},\n\nYour order #${order.orderNumber} has been confirmed.\nTotal: ${formatCurrency(order.totalAmount, order.currency)}\nDelivery: ${formatDate(order.shippingDetails.deliveryDate)}\n\nThank you for choosing SBF!`
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email notification sent successfully:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return { success: false, error: error.message };
  }
};

// Send SMS Notification
const sendSMSNotification = async (orderData) => {
  try {
    if (!twilioClient) {
      console.log('Twilio service not available, skipping SMS notification');
      return { success: false, error: 'SMS service not configured' };
    }

    const { customer, order } = orderData;
    const phoneNumber = customer.phone || order.shippingDetails.phone;
    
    if (!phoneNumber) {
      return { success: false, error: 'No phone number provided' };
    }
    
    // Use phone number as-is without adding +91 prefix
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : phoneNumber;
    
    const message = await twilioClient.messages.create({
      body: generateOrderConfirmationSMS(orderData),
      from: TWILIO_CONFIG.phoneNumber,
      to: formattedPhone
    });

    console.log('SMS notification sent successfully:', message.sid);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Failed to send SMS notification:', error);
    return { success: false, error: error.message };
  }
};

// Send WhatsApp Notification
const sendWhatsAppNotification = async (orderData) => {
  try {
    if (!twilioClient) {
      console.log('Twilio service not available, skipping WhatsApp notification');
      return { success: false, error: 'WhatsApp service not configured' };
    }

    const { customer, order } = orderData;
    const phoneNumber = customer.phone || order.shippingDetails.phone;
    
    if (!phoneNumber) {
      return { success: false, error: 'No phone number provided' };
    }
    
    // Use phone number as-is without adding +91 prefix
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : phoneNumber;
    
    const message = await twilioClient.messages.create({
      body: generateOrderConfirmationWhatsApp(orderData),
      from: `whatsapp:${TWILIO_CONFIG.phoneNumber}`,
      to: `whatsapp:${formattedPhone}`
    });

    console.log('WhatsApp notification sent successfully:', message.sid);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
    return { success: false, error: error.message };
  }
};

// Main function to send all notifications
const sendOrderNotifications = async (orderData) => {
  console.log('Sending order notifications for order:', orderData.order.orderNumber);
  
  const results = {
    email: { success: false },
    sms: { success: false },
    whatsapp: { success: false }
  };

  // Send all notifications in parallel
  try {
    const [emailResult, smsResult, whatsappResult] = await Promise.allSettled([
      sendEmailNotification(orderData),
      sendSMSNotification(orderData),
      sendWhatsAppNotification(orderData)
    ]);

    // Process results
    if (emailResult.status === 'fulfilled') {
      results.email = emailResult.value;
    } else {
      results.email = { success: false, error: emailResult.reason?.message || 'Unknown error' };
    }

    if (smsResult.status === 'fulfilled') {
      results.sms = smsResult.value;
    } else {
      results.sms = { success: false, error: smsResult.reason?.message || 'Unknown error' };
    }

    if (whatsappResult.status === 'fulfilled') {
      results.whatsapp = whatsappResult.value;
    } else {
      results.whatsapp = { success: false, error: whatsappResult.reason?.message || 'Unknown error' };
    }

    // Log summary
    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`Notification summary: ${successCount}/3 notifications sent successfully`);
    
    if (results.email.success) console.log('✅ Email sent');
    if (results.sms.success) console.log('✅ SMS sent');
    if (results.whatsapp.success) console.log('✅ WhatsApp sent');

    return results;
  } catch (error) {
    console.error('Error sending notifications:', error);
    return results;
  }
};

// Test function
const testNotificationServices = async () => {
  console.log('Testing notification services...');
  
  const testResults = {
    email: false,
    sms: false,
    whatsapp: false
  };

  // Test email
  try {
    if (emailTransporter) {
      await emailTransporter.verify();
      testResults.email = true;
      console.log('✅ Email service is working');
    } else {
      console.log('❌ Email service not configured');
    }
  } catch (error) {
    console.log('❌ Email service test failed:', error.message);
  }

  // Test Twilio
  try {
    if (twilioClient) {
      await twilioClient.api.accounts(TWILIO_CONFIG.accountSid).fetch();
      testResults.sms = true;
      testResults.whatsapp = true;
      console.log('✅ Twilio service is working');
    } else {
      console.log('❌ Twilio service not configured');
    }
  } catch (error) {
    console.log('❌ Twilio service test failed:', error.message);
  }

  return testResults;
};

// Initialize services on module load
initEmailService();
initTwilioService();

module.exports = {
  sendOrderNotifications,
  sendEmailNotification,
  sendSMSNotification,
  sendWhatsAppNotification,
  testNotificationServices,
  formatCurrency,
  formatDate
};
