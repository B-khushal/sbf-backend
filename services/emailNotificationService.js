const nodemailer = require('nodemailer');

// Initialize email service
let emailTransporter = null;

// Email configuration
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

// Initialize email service
const initEmailService = () => {
  try {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('⚠️  Email credentials not configured. Email notifications will be disabled.');
      console.warn('Add EMAIL_USER and EMAIL_PASS to your .env file to enable email notifications.');
      return null;
    }
    
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);
    console.log('✅ Email service initialized successfully');
    return emailTransporter;
  } catch (error) {
    console.error('❌ Failed to initialize email service:', error);
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
  
  return `${symbols[currency] || currency} ${Number(amount).toLocaleString()}`;
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

// Format time for display
const formatTime = (timeSlot) => {
  if (!timeSlot) return 'Standard delivery';
  
  // Handle special cases
  if (timeSlot.toLowerCase().includes('midnight')) {
    return 'Midnight Delivery (12:00 AM - 6:00 AM)';
  }
  
  return timeSlot;
};

// Generate comprehensive email template
const generateOrderConfirmationEmail = (orderData) => {
  const { order, customer, items } = orderData;
  
  const itemsList = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">
        <div style="font-weight: 600; color: #374151;">
          ${item.product.name || item.product.title}
        </div>
        ${item.product.sku ? `<div style="font-size: 12px; color: #6b7280;">SKU: ${item.product.sku}</div>` : ''}
      </td>
      <td style="padding: 12px; text-align: center; font-weight: 500;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">
        ${formatCurrency(item.finalPrice || item.price, order.currency)}
      </td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - SBF</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          line-height: 1.6; 
          color: #374151; 
          background-color: #f9fafb;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          font-size: 28px; 
          margin-bottom: 8px; 
          font-weight: 700;
        }
        .header p { 
          font-size: 16px; 
          opacity: 0.9;
        }
        .content { 
          padding: 30px; 
        }
        .order-summary { 
          background: #f8fafc; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 25px;
          border-left: 4px solid #667eea;
        }
        .order-summary h2 { 
          color: #1f2937; 
          margin-bottom: 15px; 
          font-size: 20px;
        }
        .order-detail { 
          display: flex; 
          justify-content: space-between; 
          padding: 8px 0; 
        }
        .order-detail strong { 
          color: #374151; 
        }
        .items-section { 
          margin: 25px 0; 
        }
        .items-section h3 { 
          color: #1f2937; 
          margin-bottom: 15px; 
          font-size: 18px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 8px;
        }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .items-table th { 
          background: #f3f4f6; 
          padding: 15px 12px; 
          text-align: left; 
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .total-row { 
          background: #f8fafc !important; 
          font-weight: 700; 
          font-size: 18px;
        }
        .total-row td { 
          padding: 20px 12px !important; 
          color: #667eea !important;
        }
        .address-section { 
          background: #f8fafc; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 25px 0;
        }
        .address-section h3 { 
          color: #1f2937; 
          margin-bottom: 15px; 
          font-size: 18px;
        }
        .address-details { 
          line-height: 1.8; 
          color: #4b5563;
        }
        .special-notes { 
          background: #fef3c7; 
          border: 1px solid #f59e0b; 
          padding: 15px; 
          border-radius: 6px; 
          margin: 15px 0;
        }
        .special-notes strong { 
          color: #92400e; 
        }
        .footer { 
          background: #f9fafb; 
          text-align: center; 
          padding: 30px; 
          border-top: 1px solid #e5e7eb;
        }
        .footer p { 
          margin: 8px 0; 
          color: #6b7280;
        }
        .contact-info { 
          margin-top: 20px; 
          padding-top: 20px; 
          border-top: 1px solid #e5e7eb;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #10b981;
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Confirmed!</h1>
          <p>Thank you for your order, ${customer.name}!</p>
        </div>
        
        <div class="content">
          <div class="order-summary">
            <h2>Order Summary</h2>
            <div class="order-detail">
              <span>Order Number:</span>
              <strong>${order.orderNumber}</strong>
            </div>
            <div class="order-detail">
              <span>Order Date:</span>
              <strong>${formatDate(order.createdAt)}</strong>
            </div>
            <div class="order-detail">
              <span>Status:</span>
              <span class="status-badge">Confirmed</span>
            </div>
            <div class="order-detail">
              <span>Total Amount:</span>
              <strong style="color: #667eea; font-size: 18px;">${formatCurrency(order.totalAmount, order.currency)}</strong>
            </div>
          </div>
          
          <div class="items-section">
            <h3>📦 Items Ordered</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
                <tr class="total-row">
                  <td colspan="2"><strong>Total Amount</strong></td>
                  <td style="text-align: right;"><strong>${formatCurrency(order.totalAmount, order.currency)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="address-section">
            <h3>🚚 Delivery Information</h3>
            <div class="order-detail">
              <span>Delivery Date:</span>
              <strong>${formatDate(order.shippingDetails.deliveryDate)}</strong>
            </div>
            <div class="order-detail">
              <span>Time Slot:</span>
              <strong>${formatTime(order.shippingDetails.timeSlot)}</strong>
            </div>
            <div style="margin-top: 15px;">
              <strong>Delivery Address:</strong>
              <div class="address-details">
                ${order.shippingDetails.fullName}<br>
                ${order.shippingDetails.address}<br>
                ${order.shippingDetails.apartment ? order.shippingDetails.apartment + '<br>' : ''}
                ${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}<br>
                📞 ${order.shippingDetails.phone}
              </div>
            </div>
            
            ${order.shippingDetails.notes ? `
              <div class="special-notes">
                <strong>Special Instructions:</strong> ${order.shippingDetails.notes}
              </div>
            ` : ''}
          </div>
          
          ${order.giftDetails && order.giftDetails.message ? `
            <div class="address-section">
              <h3>🎁 Gift Information</h3>
              <div class="order-detail">
                <span>Recipient:</span>
                <strong>${order.giftDetails.recipientName || 'Not specified'}</strong>
              </div>
              <div class="special-notes">
                <strong>Gift Message:</strong> ${order.giftDetails.message}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <h3 style="color: #1f2937; margin-bottom: 10px;">Thank you for choosing SBF!</h3>
          <p>We're preparing your order and will keep you updated on its progress.</p>
          
          <div class="contact-info">
            <p><strong>Need help?</strong></p>
            <p>📧 Email: support@sbf.com</p>
            <p>📞 Phone: +91-XXXX-XXXX</p>
            <p>🌐 Website: www.sbf.com</p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
            <p>This is an automated email. Please do not reply to this email address.</p>
            <p>&copy; ${new Date().getFullYear()} SBF. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate admin notification email template
const generateAdminOrderNotificationEmail = (orderData) => {
  const { order, customer, items } = orderData;
  
  const itemsList = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">
        <div style="font-weight: 600; color: #374151;">
          ${item.product.name || item.product.title}
        </div>
        ${item.product.sku ? `<div style="font-size: 12px; color: #6b7280;">SKU: ${item.product.sku}</div>` : ''}
      </td>
      <td style="padding: 12px; text-align: center; font-weight: 500;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">
        ${formatCurrency(item.finalPrice || item.price, order.currency)}
      </td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Order Alert - SBF Admin</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="font-size: 24px; margin-bottom: 8px; font-weight: 700;">🚨 New Order Alert</h1>
          <p style="font-size: 16px; opacity: 0.9;">Order #${order.orderNumber}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          
          <!-- Order Summary -->
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #dc2626;">
            <h2 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">Order Details</h2>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span><strong>Order Number:</strong></span>
              <span style="color: #374151;">${order.orderNumber}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span><strong>Order Date:</strong></span>
              <span style="color: #374151;">${formatDate(order.createdAt)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span><strong>Total Amount:</strong></span>
              <span style="color: #dc2626; font-weight: bold; font-size: 18px;">${formatCurrency(order.totalAmount, order.currency)}</span>
            </div>
          </div>
          
          <!-- Customer Details -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px;">Customer Information</h3>
            <div style="line-height: 1.8; color: #4b5563;">
              <div><strong>Name:</strong> ${customer.name}</div>
              <div><strong>Email:</strong> ${customer.email}</div>
              <div><strong>Phone:</strong> ${customer.phone}</div>
            </div>
          </div>
          
          <!-- Delivery Details -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px;">Delivery Information</h3>
            <div style="line-height: 1.8; color: #4b5563;">
              <div><strong>Address:</strong> ${order.shippingDetails.fullName}</div>
              <div>${order.shippingDetails.address}</div>
              ${order.shippingDetails.apartment ? `<div>${order.shippingDetails.apartment}</div>` : ''}
              <div>${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}</div>
              <div><strong>Phone:</strong> ${order.shippingDetails.phone}</div>
              <div><strong>Delivery Date:</strong> ${formatDate(order.shippingDetails.deliveryDate)}</div>
              <div><strong>Time Slot:</strong> ${formatTime(order.shippingDetails.timeSlot)}</div>
              ${order.shippingDetails.notes ? `<div><strong>Notes:</strong> ${order.shippingDetails.notes}</div>` : ''}
            </div>
          </div>
          
          <!-- Items -->
          <div style="margin: 25px 0;">
            <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 15px 12px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Product</th>
                  <th style="padding: 15px 12px; text-align: center; font-weight: 600; color: #374151; font-size: 14px;">Qty</th>
                  <th style="padding: 15px 12px; text-align: right; font-weight: 600; color: #374151; font-size: 14px;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
                <tr style="background: #fef2f2 !important; font-weight: 700; font-size: 16px;">
                  <td style="padding: 20px 12px !important; color: #dc2626 !important;" colspan="2">Total Amount</td>
                  <td style="padding: 20px 12px !important; color: #dc2626 !important; text-align: right;">${formatCurrency(order.totalAmount, order.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          ${order.giftDetails ? `
            <div style="background: #fef7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #a855f7;">
              <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 18px;">🎁 Gift Order</h3>
              <div style="margin-bottom: 10px;">
                <strong>Recipient:</strong> ${order.giftDetails.recipientName || 'Not specified'}
              </div>
              <div style="background: white; padding: 15px; border-radius: 6px; font-style: italic;">
                <strong>Gift Message:</strong> "${order.giftDetails.message}"
              </div>
            </div>
          ` : ''}
          
        </div>
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <h3 style="color: #1f2937; margin-bottom: 10px;">Action Required</h3>
          <p style="margin-bottom: 20px;">Please process this order and prepare for delivery.</p>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
            <p>This is an automated admin notification from SBF Order Management System.</p>
            <p>&copy; ${new Date().getFullYear()} SBF. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send email notification to both customer and admin
const sendEmailNotification = async (orderData) => {
  const results = [];
  
  try {
    if (!emailTransporter) {
      console.log('⚠️  Email service not available, skipping email notification');
      return { success: false, error: 'Email service not configured' };
    }

    const { customer, order } = orderData;
    
    // Send email to customer
    if (customer.email) {
      try {
        const customerMailOptions = {
      from: {
        name: 'SBF Store',
        address: EMAIL_CONFIG.auth.user
      },
      to: customer.email,
      subject: `🎉 Order Confirmed #${order.orderNumber} - SBF Store`,
      html: generateOrderConfirmationEmail(orderData),
      text: `Order Confirmation - SBF Store

Hi ${customer.name},

Your order #${order.orderNumber} has been confirmed!

Order Details:
- Order Number: ${order.orderNumber}
- Total Amount: ${formatCurrency(order.totalAmount, order.currency)}
- Delivery Date: ${formatDate(order.shippingDetails.deliveryDate)}
- Time Slot: ${formatTime(order.shippingDetails.timeSlot)}

Delivery Address:
${order.shippingDetails.fullName}
${order.shippingDetails.address}
${order.shippingDetails.apartment ? order.shippingDetails.apartment : ''}
${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}
Phone: ${order.shippingDetails.phone}

Thank you for choosing SBF! We'll keep you updated on your order status.

Best regards,
SBF Team`
    };

        const customerResult = await emailTransporter.sendMail(customerMailOptions);
        console.log('✅ Customer email sent successfully to:', customer.email);
        console.log('📧 Customer email Message ID:', customerResult.messageId);
        
        results.push({
          type: 'customer',
          success: true,
          messageId: customerResult.messageId,
          recipient: customer.email
        });
      } catch (customerError) {
        console.error('❌ Failed to send customer email:', customerError);
        results.push({
          type: 'customer',
          success: false,
          error: customerError.message,
          recipient: customer.email
        });
      }
    } else {
      console.warn('⚠️  No customer email address provided');
      results.push({
        type: 'customer',
        success: false,
        error: 'No customer email address provided',
        recipient: 'N/A'
      });
    }

    // Send email to admin
    const adminEmail = '2006sbf@gmail.com';
    try {
      const adminMailOptions = {
        from: {
          name: 'SBF Order System',
          address: EMAIL_CONFIG.auth.user
        },
        to: adminEmail,
        subject: `🚨 New Order Alert #${order.orderNumber} - ${formatCurrency(order.totalAmount, order.currency)}`,
        html: generateAdminOrderNotificationEmail(orderData),
        text: `New Order Alert - SBF Admin

Order #${order.orderNumber} has been placed!

Customer: ${customer.name}
Email: ${customer.email}
Phone: ${customer.phone}
Total Amount: ${formatCurrency(order.totalAmount, order.currency)}
Delivery Date: ${formatDate(order.shippingDetails.deliveryDate)}
Time Slot: ${formatTime(order.shippingDetails.timeSlot)}

Delivery Address:
${order.shippingDetails.fullName}
${order.shippingDetails.address}
${order.shippingDetails.apartment ? order.shippingDetails.apartment : ''}
${order.shippingDetails.city}, ${order.shippingDetails.state} ${order.shippingDetails.zipCode}

Please process this order promptly.

SBF Order Management System`
      };

      const adminResult = await emailTransporter.sendMail(adminMailOptions);
      console.log('✅ Admin email sent successfully to:', adminEmail);
      console.log('📧 Admin email Message ID:', adminResult.messageId);
      
      results.push({
        type: 'admin',
        success: true,
        messageId: adminResult.messageId,
        recipient: adminEmail
      });
    } catch (adminError) {
      console.error('❌ Failed to send admin email:', adminError);
      results.push({
        type: 'admin',
        success: false,
        error: adminError.message,
        recipient: adminEmail
      });
    }

    // Return overall result
    const allSuccessful = results.every(result => result.success);
    const someSuccessful = results.some(result => result.success);
    
    return { 
      success: allSuccessful,
      partialSuccess: someSuccessful && !allSuccessful,
      results: results,
      summary: `${results.filter(r => r.success).length}/${results.length} emails sent successfully`
    };
    
  } catch (error) {
    console.error('❌ Failed to send email notifications:', error);
    return { 
      success: false, 
      error: error.message,
      results: results
    };
  }
};

// Test email service
const testEmailService = async () => {
  console.log('🧪 Testing email service...');
  
  try {
    if (!emailTransporter) {
      console.log('❌ Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    await emailTransporter.verify();
    console.log('✅ Email service is working correctly');
    return { success: true, message: 'Email service is working' };
  } catch (error) {
    console.log('❌ Email service test failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Send test email
const sendTestEmail = async (testEmail = 'test@example.com') => {
  const sampleOrderData = {
    order: {
      orderNumber: `TEST-${Date.now()}`,
      totalAmount: 1299.50,
      currency: 'INR',
      createdAt: new Date(),
      shippingDetails: {
        fullName: 'Test Customer',
        phone: '+919876543210',
        address: '123 Test Street, Test Area',
        apartment: 'Apartment 4B',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        timeSlot: '10:00 AM - 2:00 PM',
        notes: 'This is a test order for email notification system verification.'
      },
      giftDetails: {
        message: 'Happy Birthday! Hope you enjoy this gift.',
        recipientName: 'Gift Recipient'
      }
    },
    customer: {
      name: 'Test Customer',
      email: testEmail
    },
    items: [
      {
        product: {
          name: 'Premium Test Product',
          title: 'Premium Test Product',
          sku: 'TEST-001'
        },
        quantity: 2,
        price: 599.99,
        finalPrice: 549.99
      },
      {
        product: {
          name: 'Sample Item',
          title: 'Sample Item',
          sku: 'TEST-002'
        },
        quantity: 1,
        price: 199.52,
        finalPrice: 199.52
      }
    ]
  };

  return await sendEmailNotification(sampleOrderData);
};

// Get email configuration status
const getEmailConfig = () => {
  return {
    configured: !!(EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass),
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    user: EMAIL_CONFIG.auth.user ? 
      EMAIL_CONFIG.auth.user.replace(/(.{3}).*@/, '$1***@') : 
      'Not configured',
    status: emailTransporter ? 'Ready' : 'Not configured'
  };
};

// Initialize email service on module load
initEmailService();

module.exports = {
  sendEmailNotification,
  testEmailService,
  sendTestEmail,
  getEmailConfig,
  formatCurrency,
  formatDate,
  formatTime
};
