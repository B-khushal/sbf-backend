const nodemailer = require('nodemailer');
const pdf = require('html-pdf');

// Initialize email service
let emailTransporter = null;
let orderConfirmationTransporter = null;
let deliveryConfirmationTransporter = null;

// Email configuration for order confirmations
const ORDER_CONFIRMATION_EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.ORDER_CONFIRMATION_EMAIL_USER || 'sbforderconfirmation@gmail.com',
    pass: process.env.ORDER_CONFIRMATION_EMAIL_PASS || 'pbxtmsnseknrxrnx'
  }
};

// Email configuration for delivery confirmations
const DELIVERY_CONFIRMATION_EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.DELIVERY_CONFIRMATION_EMAIL_USER || 'sbfdeliveryconfirmation@gmail.com',
    pass: process.env.DELIVERY_CONFIRMATION_EMAIL_PASS || 'ywmxpkbqitvrpdqx'
  }
};

// Legacy email configuration (fallback)
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

// Initialize order confirmation email service
const initOrderConfirmationEmailService = () => {
  try {
    orderConfirmationTransporter = nodemailer.createTransport(ORDER_CONFIRMATION_EMAIL_CONFIG);
    console.log('✅ Order confirmation email service initialized successfully');
    return orderConfirmationTransporter;
  } catch (error) {
    console.error('❌ Failed to initialize order confirmation email service:', error.message);
    return null;
  }
};

// Initialize delivery confirmation email service
const initDeliveryConfirmationEmailService = () => {
  try {
    deliveryConfirmationTransporter = nodemailer.createTransport(DELIVERY_CONFIRMATION_EMAIL_CONFIG);
    console.log('✅ Delivery confirmation email service initialized successfully');
    return deliveryConfirmationTransporter;
  } catch (error) {
    console.error('❌ Failed to initialize delivery confirmation email service:', error.message);
    return null;
  }
};

// Initialize email service (legacy fallback)
const initEmailService = () => {
  try {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('⚠️  Legacy email credentials not configured. Using dedicated email services.');
      // Initialize dedicated email services
      initOrderConfirmationEmailService();
      initDeliveryConfirmationEmailService();
      return null;
    }
    
    emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
    console.log('✅ Legacy email service initialized successfully');
    return emailTransporter;
  } catch (error) {
    console.error('❌ Failed to initialize legacy email service:', error.message);
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

// Generate PDF from HTML
const generateInvoicePDF = (htmlContent, orderNumber) => {
  return new Promise((resolve, reject) => {
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      header: {
        height: '20mm'
      },
      footer: {
        height: '20mm'
      },
      type: 'pdf',
      quality: '75',
      httpHeaders: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    };

    pdf.create(htmlContent, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('❌ Failed to generate PDF:', err);
        reject(err);
      } else {
        console.log('✅ PDF generated successfully');
        resolve(buffer);
      }
    });
  });
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
              <span>Time Slot: </span>
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
            <p>📧 Email: 2006sbf@gmail.com</p>
            <p>📞 Phone: 9849589710</p>
            <p>🌐 Website: www.sbflorist.com</p>
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

// Generate delivery confirmation email template with invoice
const generateDeliveryConfirmationWithInvoiceEmail = (orderData) => {
  const { order, customer } = orderData;
  const items = order.items || [];
  
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

  // Calculate proper subtotal from items
  const itemsSubtotal = items.reduce((sum, item) => {
    return sum + ((item.finalPrice || item.price) * item.quantity);
  }, 0);
  
  const shippingCharges = order.shippingFee || order.shippingCharges || 0;
  
  // Only calculate GST if there are shipping charges
  const hasShipping = shippingCharges > 0;
  const cgst = hasShipping ? shippingCharges * 0.025 : 0; // 2.5% CGST only on shipping
  const sgst = hasShipping ? shippingCharges * 0.025 : 0; // 2.5% SGST only on shipping
  const grandTotal = itemsSubtotal + shippingCharges + cgst + sgst;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Confirmation & Invoice - Spring Blossoms Florist</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          line-height: 1.6; 
          color: #374151; 
          background-color: #f9fafb;
        }
        .container { 
          max-width: 700px; 
          margin: 0 auto; 
          background-color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
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
        .delivery-status { 
          background: #ecfdf5; 
          border: 2px solid #10b981;
          padding: 20px; 
          border-radius: 12px; 
          margin-bottom: 25px;
          text-align: center;
        }
        .delivery-status h2 { 
          color: #065f46; 
          margin-bottom: 10px; 
          font-size: 24px;
        }
        .delivery-status p { 
          color: #047857; 
          font-size: 16px;
        }
        .invoice-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
        }
        .company-header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          text-align: center;
          padding: 30px;
          border-radius: 12px 12px 0 0;
          margin-bottom: 25px;
        }
        .company-header h1 {
          color: white;
          font-size: 32px;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .company-details {
          color: #d1fae5;
          font-size: 15px;
          line-height: 1.8;
        }
        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          flex-wrap: wrap;
        }
        .invoice-details h3 {
          color: #1f2937;
          font-size: 20px;
          margin-bottom: 10px;
        }
        .invoice-details p {
          margin: 5px 0;
          color: #6b7280;
        }
        .bill-to {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #3b82f6;
        }
        .bill-to h4 {
          color: #1f2937;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin: 20px 0;
        }
        .items-table th { 
          background: #f1f5f9; 
          padding: 15px 12px; 
          text-align: left; 
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          border-bottom: 2px solid #e2e8f0;
        }
        .items-table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .total-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .grand-total {
          background: #f0f9ff;
          padding: 15px;
          border-radius: 8px;
          margin-top: 10px;
          border: 2px solid #0ea5e9;
        }
        .grand-total .total-row {
          font-weight: 700;
          font-size: 18px;
          color: #0369a1;
          border: none;
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
        .thank-you {
          background: #fef7cd;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
          text-align: center;
        }
        .thank-you h3 {
          color: #92400e;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Order Delivered Successfully!</h1>
          <p>Thank you for choosing Spring Blossoms Florist</p>
        </div>
        
        <div class="content">
          <div class="delivery-status">
            <h2>✅ Delivery Completed</h2>
            <p>Your order has been successfully delivered on ${formatDate(new Date())}</p>
          </div>

          <div class="thank-you">
            <h3>Thank You for Your Order!</h3>
            <p>We hope you love your beautiful floral arrangement. Please find your invoice below.</p>
          </div>

          <div class="invoice-section">
            <div class="company-header">
              <h1>Spring Blossoms Florist</h1>
              <div class="company-details">
                <p><strong>Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32</strong></p>
                <p>Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028</p>
                <p>📞 9849589710 | ✉️ 2006sbf@gmail.com</p>
                <p>🌐 www.sbflorist.com | Premium Floral Services</p>
              </div>
            </div>

            <div class="invoice-header">
              <div class="invoice-details">
                <h3>INVOICE</h3>
                <p><strong>Invoice #:</strong> INV-${order.orderNumber}</p>
                <p><strong>Date:</strong> ${formatDate(new Date())}</p>
                <p><strong>Order #:</strong> ${order.orderNumber}</p>
              </div>
              
              <div class="invoice-details">
                <h3>Order Information</h3>
                <p><strong>Order Date:</strong> ${formatDate(order.createdAt)}</p>
                <p><strong>Delivery Date:</strong> ${formatDate(order.shippingDetails?.deliveryDate || new Date())}</p>
                <p><strong>Time Slot:</strong> ${formatTime(order.shippingDetails?.timeSlot)}</p>
              </div>
            </div>

            <div class="bill-to">
              <h4>📍 Delivery Address:</h4>
              <p><strong>${order.shippingDetails?.fullName || customer.name}</strong></p>
              <p>${order.shippingDetails?.address}</p>
              ${order.shippingDetails?.apartment ? `<p>${order.shippingDetails.apartment}</p>` : ''}
              <p>${order.shippingDetails?.city}, ${order.shippingDetails?.state} ${order.shippingDetails?.zipCode}</p>
              <p>📞 ${order.shippingDetails?.phone}</p>
            </div>

            <div class="bill-to">
              <h4>👤 Customer Information:</h4>
              <p><strong>${customer.name}</strong></p>
              <p>📧 ${customer.email}</p>
              ${customer.phone ? `<p>📞 ${customer.phone}</p>` : ''}
            </div>

            <h4 style="margin-top: 30px; margin-bottom: 15px;">Order Details</h4>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price (₹)</th>
                  <th style="text-align: right;">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${item.product.name || item.product.title}</div>
                      <div style="font-size: 12px; color: #6b7280;">A beautiful arrangement of premium flowers</div>
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">₹${(item.finalPrice || item.price).toFixed(2)}</td>
                    <td style="text-align: right;">₹${((item.finalPrice || item.price) * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-section">
              <div class="total-row">
                <span>Subtotal</span>
                <span>₹${(itemsSubtotal).toFixed(2)}</span>
              </div>
              ${hasShipping ? `
                <div class="total-row">
                  <span>Delivery Charges</span>
                  <span>₹${shippingCharges.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Tax (5%)</span>
                  <span>₹${(cgst + sgst).toFixed(2)}</span>
                </div>
              ` : ''}
              
              <div class="grand-total">
                <div class="total-row">
                  <span>GRAND TOTAL</span>
                  <span>₹${(grandTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="margin-top: 25px; padding: 15px; background: #f0f9ff; border-radius: 8px;">
              <h4 style="color: #1f2937; margin-bottom: 10px;">Payment Information:</h4>
              <p><strong>Method:</strong> Razorpay (Online Payment)</p>
              <p><strong>Status:</strong> Completed</p>
              ${order.paymentDetails?.paymentId ? `<p><strong>Transaction ID:</strong> ${order.paymentDetails.paymentId}</p>` : ''}
            </div>
          </div>
        </div>
        
        <div class="footer">
          <h3 style="color: #1f2937; margin-bottom: 15px;">Thank you for your business!</h3>
          <p>We appreciate your order and hope you enjoyed our flowers.</p>
          <p>For any questions regarding your order or our products, please don't hesitate to contact us.</p>
          <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            📧 2006sbf@gmail.com | 📞 9849589710<br>
            Business Hours: Monday - Saturday, 9 AM - 6 PM IST
          </p>
          <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
            Terms and conditions apply. For our return and refund policy, please visit www.sbflorist.in/returns.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send delivery confirmation email with invoice
const sendDeliveryConfirmationWithInvoice = async (orderData) => {
  try {
    // Use delivery confirmation transporter, fallback to legacy transporter
    const activeTransporter = deliveryConfirmationTransporter || emailTransporter;
    const senderEmail = deliveryConfirmationTransporter ? 'sbfdeliveryconfirmation@gmail.com' : '2006sbf@gmail.com';
    
    if (!activeTransporter) {
      console.log('⚠️  Email service not available, skipping delivery confirmation email');
      return { success: false, error: 'Email service not configured' };
    }

    const { customer, order } = orderData;
    
    if (!customer.email) {
      return { success: false, error: 'No customer email address provided' };
    }

    console.log('📄 Generating PDF invoice...');
    
    // Generate HTML content for the invoice
    const htmlContent = generateDeliveryConfirmationWithInvoiceEmail(orderData);
    
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(htmlContent, order.orderNumber);
    
    console.log('✅ PDF invoice generated successfully');

    const mailOptions = {
      from: {
        name: 'Spring Blossoms Florist',
        address: senderEmail
      },
      to: customer.email,
      cc: '2006sbf@gmail.com', // Send copy to business email
      subject: `🎉 Order Delivered & Invoice #INV-${order.orderNumber} - Spring Blossoms Florist`,
      html: htmlContent,
      attachments: [
        {
          filename: `Invoice-${order.orderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
      text: `Delivery Confirmation & Invoice - Spring Blossoms Florist

Dear ${customer.name},

Great news! Your order #${order.orderNumber} has been delivered successfully!

Order Details:
- Order Number: ${order.orderNumber}
- Invoice Number: INV-${order.orderNumber}
- Total Amount: ${formatCurrency(order.totalAmount, order.currency)}
- Delivered On: ${formatDate(new Date())}

Delivery Address:
${order.shippingDetails?.fullName || customer.name}
${order.shippingDetails?.address}
${order.shippingDetails?.city}, ${order.shippingDetails?.state} ${order.shippingDetails?.zipCode}

Thank you for choosing Spring Blossoms Florist! We hope you love your beautiful arrangement.

Please find your detailed invoice attached as a PDF.

For any questions, please contact us at 2006sbf@gmail.com or call 9849589710.

Best regards,
Spring Blossoms Florist Team`
    };

    const result = await activeTransporter.sendMail(mailOptions);
    console.log('✅ Delivery confirmation email with PDF invoice sent successfully:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Failed to send delivery confirmation email:', error);
    return { success: false, error: error.message };
  }
};

// Send email notification to both customer and admin
const sendEmailNotification = async (orderData) => {
  const results = [];
  
  try {
    // Use order confirmation transporter for customer emails, fallback to legacy transporter
    const activeTransporter = orderConfirmationTransporter || emailTransporter;
    const senderEmail = orderConfirmationTransporter ? 'sbforderconfirmation@gmail.com' : '2006sbf@gmail.com';
    
    if (!activeTransporter) {
      console.log('⚠️  Email service not available, skipping email notification');
      return { success: false, error: 'Email service not configured' };
    }

    const { customer, order } = orderData;
    
    // Send email to customer
    if (customer.email) {
      try {
        const customerMailOptions = {
      from: {
        name: 'Spring Blossoms Florist',
        address: senderEmail
      },
      to: customer.email,
              subject: `🎉 Order Confirmed #${order.orderNumber} - Spring Blossoms Florist`,
      html: generateOrderConfirmationEmail(orderData),
              text: `Order Confirmation - Spring Blossoms Florist

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

Thank you for choosing Spring Blossoms Florist! We'll keep you updated on your order status.

Best regards,
Spring Blossoms Florist Team`
    };

        const customerResult = await activeTransporter.sendMail(customerMailOptions);
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
          name: 'Spring Blossoms Florist Order System',
          address: '2006sbf@gmail.com'
        },
        to: adminEmail,
        subject: `🚨 New Order Alert #${order.orderNumber} - ${formatCurrency(order.totalAmount, order.currency)}`,
        html: generateAdminOrderNotificationEmail(orderData),
        text: `New Order Alert - Spring Blossoms Florist Admin

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

Spring Blossoms Florist Order Management System`
      };

      const adminResult = await activeTransporter.sendMail(adminMailOptions);
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
  console.log('🧪 Testing email services...');
  
  const testResults = {
    legacy: { success: false },
    orderConfirmation: { success: false },
    deliveryConfirmation: { success: false }
  };
  
  // Test legacy email service
  try {
    if (emailTransporter) {
      await emailTransporter.verify();
      console.log('✅ Legacy email service is working correctly');
      testResults.legacy = { success: true, message: 'Legacy email service is working' };
    } else {
      console.log('⚠️  Legacy email service not configured');
      testResults.legacy = { success: false, error: 'Legacy email service not configured' };
    }
  } catch (error) {
    console.log('❌ Legacy email service test failed:', error.message);
    testResults.legacy = { success: false, error: error.message };
  }
  
  // Test order confirmation email service
  try {
    if (orderConfirmationTransporter) {
      await orderConfirmationTransporter.verify();
      console.log('✅ Order confirmation email service is working correctly');
      testResults.orderConfirmation = { success: true, message: 'Order confirmation email service is working' };
    } else {
      console.log('❌ Order confirmation email service not configured');
      testResults.orderConfirmation = { success: false, error: 'Order confirmation email service not configured' };
    }
  } catch (error) {
    console.log('❌ Order confirmation email service test failed:', error.message);
    testResults.orderConfirmation = { success: false, error: error.message };
  }
  
  // Test delivery confirmation email service
  try {
    if (deliveryConfirmationTransporter) {
      await deliveryConfirmationTransporter.verify();
      console.log('✅ Delivery confirmation email service is working correctly');
      testResults.deliveryConfirmation = { success: true, message: 'Delivery confirmation email service is working' };
    } else {
      console.log('❌ Delivery confirmation email service not configured');
      testResults.deliveryConfirmation = { success: false, error: 'Delivery confirmation email service not configured' };
    }
  } catch (error) {
    console.log('❌ Delivery confirmation email service test failed:', error.message);
    testResults.deliveryConfirmation = { success: false, error: error.message };
  }
  
  const overallSuccess = testResults.orderConfirmation.success && testResults.deliveryConfirmation.success;
  
  return { 
    success: overallSuccess, 
    details: testResults,
    message: overallSuccess ? 'All email services are working' : 'Some email services have issues'
  };
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
    legacy: {
      configured: !!(EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass),
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      user: EMAIL_CONFIG.auth.user ? 
        EMAIL_CONFIG.auth.user.replace(/(.{3}).*@/, '$1***@') : 
        'Not configured',
      status: emailTransporter ? 'Ready' : 'Not configured'
    },
    orderConfirmation: {
      configured: true,
      host: ORDER_CONFIRMATION_EMAIL_CONFIG.host,
      port: ORDER_CONFIRMATION_EMAIL_CONFIG.port,
      user: ORDER_CONFIRMATION_EMAIL_CONFIG.auth.user.replace(/(.{3}).*@/, '$1***@'),
      status: orderConfirmationTransporter ? 'Ready' : 'Not configured'
    },
    deliveryConfirmation: {
      configured: true,
      host: DELIVERY_CONFIRMATION_EMAIL_CONFIG.host,
      port: DELIVERY_CONFIRMATION_EMAIL_CONFIG.port,
      user: DELIVERY_CONFIRMATION_EMAIL_CONFIG.auth.user.replace(/(.{3}).*@/, '$1***@'),
      status: deliveryConfirmationTransporter ? 'Ready' : 'Not configured'
    }
  };
};

// Initialize email services on module load
initEmailService();
initOrderConfirmationEmailService();
initDeliveryConfirmationEmailService();

module.exports = {
  sendEmailNotification,
  testEmailService,
  sendTestEmail,
  getEmailConfig,
  initEmailService,
  initOrderConfirmationEmailService,
  initDeliveryConfirmationEmailService,
  formatCurrency,
  formatDate,
  formatTime,
  sendDeliveryConfirmationWithInvoice
};
