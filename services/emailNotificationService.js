const nodemailer = require('nodemailer');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');
const { getPdfOptions } = require('../utils/pdfHelper');
const { sendEmail } = require('./emailService');

// Initialize email service
let emailTransporter = null;
let orderConfirmationTransporter = null;
let deliveryConfirmationTransporter = null;

const getFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || 'https://sbflorist.in';
  if (url.includes('onrender.com')) {
    return 'https://sbflorist.in';
  }
  return url;
};

// Email configuration for order confirmations
const ORDER_CONFIRMATION_EMAIL_CONFIG = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.ORDER_CONFIRMATION_EMAIL_USER || 'sbforderconfirmation@gmail.com',
    pass: process.env.ORDER_CONFIRMATION_EMAIL_PASS || 'mgcwrebhbyyilstd'
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
    pass: process.env.DELIVERY_CONFIRMATION_EMAIL_PASS || 'kfpplcumkbdywbil'
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

// Format date for display (forcing Asia/Kolkata timezone to avoid UTC offset discrepancies on server)
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

// Format time for display
const formatTime = (timeSlot) => {
  if (!timeSlot) return 'Standard delivery';

  const lowerSlot = timeSlot.toLowerCase();
  if (lowerSlot === 'same_day') return 'Same-Day Delivery (09:00 AM - 09:00 PM)';
  if (lowerSlot === 'morning') return 'Morning (09:00 AM - 12:00 PM)';
  if (lowerSlot === 'afternoon') return 'Afternoon (12:00 PM - 03:00 PM)';
  if (lowerSlot === 'late_afternoon') return 'Late Afternoon (03:00 PM - 06:00 PM)';
  if (lowerSlot === 'evening') return 'Evening (06:00 PM - 09:00 PM)';

  // Handle special cases
  if (lowerSlot.includes('midnight')) {
    return 'Midnight Delivery (12:00 AM - 6:00 AM)';
  }

  return timeSlot;
};

// Generate PDF from HTML
const generateInvoicePDF = async (htmlContent, orderNumber) => {
  // Ensure PhantomJS binary is present (self-healing runtime check)
  const { ensurePhantomJS } = require('../utils/pdfHelper');
  try {
    await ensurePhantomJS();
  } catch (err) {
    console.error('❌ Failed to ensure PhantomJS binary on startup check:', err.message);
  }

  return new Promise((resolve, reject) => {
    const options = getPdfOptions({ documentTitle: 'Tax Invoice' });

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
            
            ${(order.shippingDetails.deliverySpecialInstructions || order.shippingDetails.notes) ? `
              <div class="special-notes">
                <strong>Special Instructions:</strong> ${order.shippingDetails.deliverySpecialInstructions || order.shippingDetails.notes}
              </div>
            ` : ''}
          </div>
          
          ${(order.shippingDetails.cardMessage || order.shippingDetails.giftMessage || (order.giftDetails && order.giftDetails.message)) ? `
            <div class="address-section">
              <h3>💌 Card Message</h3>
              <div class="special-notes">
                <strong>Message:</strong> ${order.shippingDetails.cardMessage || order.shippingDetails.giftMessage || order.giftDetails.message}
              </div>
              ${order.giftDetails && order.giftDetails.recipientName ? `
                <div class="order-detail" style="margin-top: 10px;">
                  <span>Recipient:</span>
                  <strong>${order.giftDetails.recipientName}</strong>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <h3 style="color: #1f2937; margin-bottom: 10px;">Thank you for choosing SBF!</h3>
          <p>We're preparing your order and will keep you updated on its progress.</p>
          
          <div class="contact-info">
            <p><strong>Need help?</strong></p>
            <p>📧 Email: contact@sbflorist.in</p>
            <p>📞 Phone: 9949683222</p>
            <p>🌐 Website: <a href="${getFrontendUrl()}">${getFrontendUrl().replace(/^https?:\/\//, '')}</a></p>
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
              ${(order.shippingDetails.cardMessage || order.shippingDetails.giftMessage) ? `<div><strong>Card Message:</strong> ${order.shippingDetails.cardMessage || order.shippingDetails.giftMessage}</div>` : ''}
              ${(order.shippingDetails.deliverySpecialInstructions || order.shippingDetails.notes) ? `<div><strong>Special Instructions:</strong> ${order.shippingDetails.deliverySpecialInstructions || order.shippingDetails.notes}</div>` : ''}
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

// ============================================================
// Generate standalone invoice HTML (reusable for PDF + email)
// This is the SINGLE SOURCE OF TRUTH for the invoice design.
// Clean, compact, professional, single-page layout for PDF + print.
// ============================================================
const generateInvoiceHTML = (orderData) => {
  const { order, customer } = orderData;
  const items = order.items || [];
  const shipping = order.shippingDetails || order.shipping || {};

  // Calculate pricing
  const itemsSubtotal = order.subtotal || items.reduce((sum, item) => {
    return sum + ((item.finalPrice || item.price) * item.quantity);
  }, 0);

  const deliveryFee = order.deliveryFee || order.shippingFee || order.shippingCharges || 0;
  const promoDiscount = order.promoCode?.discount || order.discountAmount || order.promoDiscount || 0;
  const hasDeliveryFee = deliveryFee > 0;
  const hasPromo = promoDiscount > 0;
  const grandTotal = order.totalAmount || order.total || (itemsSubtotal + deliveryFee - promoDiscount);

  const invoiceNumber = `INV-${order.orderNumber}`;
  const orderDate = formatDate(order.createdAt);
  const deliveryDate = formatDate(shipping.deliveryDate || order.deliveredAt || new Date());

  // Load logo
  let logoBase64 = '';
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    }
  } catch (err) {
    console.error('Failed to load invoice logo:', err);
  }

  const isGift = shipping.deliveryOption === 'gift' || (order.giftDetails && order.giftDetails.message);
  const recipientName = isGift
    ? `${order.giftDetails?.recipientName || ''}`.trim() || `${shipping.receiverFirstName || ''} ${shipping.receiverLastName || ''}`.trim() || 'N/A'
    : `${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || shipping.fullName || customer.name || 'N/A';
  const recipientPhone = isGift
    ? (order.giftDetails?.recipientPhone || shipping.receiverPhone || 'N/A')
    : (shipping.phone || customer.phone || 'N/A');
  const recipientAddress = isGift
    ? (order.giftDetails?.recipientAddress || shipping.receiverAddress || 'N/A')
    : (shipping.address || 'N/A');
  const recipientApartment = isGift
    ? (order.giftDetails?.recipientApartment || shipping.receiverApartment)
    : (shipping.apartment);
  const recipientCity = isGift
    ? (order.giftDetails?.recipientCity || shipping.receiverCity || '')
    : (shipping.city || '');
  const recipientState = isGift
    ? (order.giftDetails?.recipientState || shipping.receiverState || '')
    : (shipping.state || '');
  const recipientZip = isGift
    ? (order.giftDetails?.recipientZipCode || shipping.receiverZipCode || '')
    : (shipping.zipCode || '');

  // Payment details (supports both Order and InvoiceOrder interfaces)
  const paymentMethod = order.payment?.method || order.paymentDetails?.method || 'Online Payment';
  const paymentStatus = order.payment?.status || order.paymentDetails?.status || 'Completed';
  const transactionId = order.payment?.transactionId || order.paymentDetails?.transactionId || order.paymentDetails?.razorpayPaymentId || order.paymentDetails?.paymentId || '';

  const itemRows = items.map((item, index) => {
    const title = item.product?.title || item.title || 'Florist Arrangement';
    const variantText = item.selectedVariant?.label ? `Variant: ${item.selectedVariant.label}` : 'Premium Arrangement';
    const customText = item.customizations?.messageCard ? `Message Card Included` : '';
    
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; color: #1e293b; font-size: 11px; font-weight: 500; word-break: break-word;">
          <div style="font-weight: 700; color: #0f172a;">${title}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${variantText}</div>
          ${customText ? `<div style="font-size: 9px; color: #b45309; font-weight: 600; margin-top: 1px;">✨ ${customText}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; color: #475569; font-size: 11px; vertical-align: middle;">${item.quantity}</td>
        <td style="padding: 10px 12px; text-align: right; color: #475569; font-size: 11px; vertical-align: middle; white-space: nowrap;">${formatCurrency(item.finalPrice || item.price, order.currency)}</td>
        <td style="padding: 10px 12px; text-align: right; color: #1e293b; font-size: 11px; font-weight: 700; vertical-align: middle; white-space: nowrap;">${formatCurrency((item.finalPrice || item.price) * item.quantity, order.currency)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 11px;
          color: #334155;
          background: #fff;
          line-height: 1.4;
          zoom: 1;
          transform: none;
          -webkit-print-color-adjust: exact;
        }
        .invoice-container {
          width: 186mm;
          min-height: 273mm;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
          background-color: #fff;
          padding-bottom: 25mm; /* Allocate space for absolute positioned footer */
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .details-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          padding: 10px 12px;
          margin-bottom: 12px;
        }
        .card-title {
          font-size: 12px; /* Section Titles: 12-14px bold uppercase */
          font-weight: 700;
          color: #064e3b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        .invoice-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          text-align: center;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
        .footer-text {
          font-size: 8.5px; /* Footer Text: 8-9px */
          color: #94a3b8;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">

        <!-- BRAND HEADER -->
        <table style="margin-bottom: 15px;">
          <tr>
            <td style="vertical-align: top; width: 60%;">
              <table>
                <tr>
                  ${logoBase64 ? `<td style="vertical-align: middle; width: 55px; padding-right: 12px;"><img src="${logoBase64}" alt="Logo" style="height: 50px; object-fit: contain;" /></td>` : ''}
                  <td style="vertical-align: top;">
                    <h1 style="font-size: 26px; font-weight: 800; color: #064e3b; line-height: 1.1; margin: 0 0 2px 0;">Spring Blossoms Florist</h1>
                    <p style="font-size: 10px; color: #c5a880; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">A Reason to Express</p>
                    <p style="font-size: 10px; color: #64748b; line-height: 1.3; margin: 0;">
                      Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32,<br>
                      Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028<br>
                      <strong>GSTIN:</strong> 36AABFS1234Z1Z5 | <strong>Ph:</strong> +91 9949683222
                    </p>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: top; text-align: right; width: 40%;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 12px; display: inline-block; text-align: left; width: 65mm;">
                <h2 style="font-size: 28px; font-weight: 850; color: #064e3b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #064e3b; padding-bottom: 4px; margin-bottom: 6px; text-align: right;">TAX INVOICE</h2>
                <table style="font-size: 10px; line-height: 1.3;">
                  <tr>
                    <td style="color: #64748b; font-weight: 600; padding: 1px 0;">Invoice No:</td>
                    <td style="font-weight: 700; color: #064e3b; text-align: right; padding: 1px 0;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600; padding: 1px 0;">Order Date:</td>
                    <td style="color: #334155; font-weight: 600; text-align: right; padding: 1px 0;">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600; padding: 1px 0;">Delivery Date:</td>
                    <td style="color: #334155; font-weight: 600; text-align: right; padding: 1px 0;">${deliveryDate}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
        </table>

        <!-- DOUBLE DECORATIVE BORDER -->
        <div style="height: 3px; background: #064e3b; margin-bottom: 2px; border-radius: 2px;"></div>
        <div style="height: 1px; background: #c5a880; margin-bottom: 12px;"></div>

        <!-- CUSTOMER & SHIPPING CARDS ROW -->
        <table style="margin-bottom: 12px;">
          <tr>
            <td style="width: 48%; vertical-align: top;">
              <div class="details-card" style="margin-bottom: 0; min-height: 48mm; border-left: 3px solid #064e3b;">
                <div class="card-title">Billing Details</div>
                <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  ${order.shippingDetails?.fullName || customer.name || 'Valued Customer'}
                </div>
                <div style="font-size: 10px; color: #475569; line-height: 1.4; margin-top: 4px;">
                  <strong>Email:</strong> ${customer.email || 'N/A'}<br>
                  <strong>Phone:</strong> ${customer.phone || 'N/A'}<br>
                  <strong>Billing Address:</strong> Same as Shipping Address
                </div>
              </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%; vertical-align: top;">
              <div class="details-card" style="margin-bottom: 0; min-height: 48mm; border-left: 3px solid #c5a880;">
                <div class="card-title">${isGift ? 'Delivery Recipient (Gift)' : 'Delivery Address'}</div>
                <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  ${recipientName}
                </div>
                <div style="font-size: 10px; color: #475569; line-height: 1.4; margin-top: 4px;">
                  <strong>Phone:</strong> ${recipientPhone}<br>
                  <strong>Address:</strong> ${recipientAddress}${recipientApartment ? ', ' + recipientApartment : ''}, ${recipientCity}${recipientState ? ', ' + recipientState : ''} ${recipientZip}
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- ITEMS TABLE -->
        <table style="margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; table-layout: auto;">
          <thead>
            <tr style="background-color: #f0fdf4; border-bottom: 2px solid #064e3b;">
              <th style="padding: 10px 12px; text-align: left; font-weight: 700; color: #064e3b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Item Description</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700; color: #064e3b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 12%;">Qty</th>
              <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #064e3b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 18%;">Unit Price</th>
              <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #064e3b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 18%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- TOTALS & METADATA GRID ROW -->
        <table style="margin-bottom: 12px;">
          <tr>
            <td style="width: 55%; vertical-align: top;">
              <!-- PAYMENT & LOGISTICS -->
              <table style="margin-bottom: 8px;">
                <tr>
                  <td style="padding-right: 10px; vertical-align: top; width: 50%;">
                    <div class="details-card" style="padding: 8px 10px; min-height: 28mm; border-left: 2px solid #3b82f6; margin-bottom: 0;">
                      <div class="card-title" style="font-size: 10px; color: #3b82f6; border-bottom: 1px solid #eff6ff; margin-bottom: 4px; padding-bottom: 2px;">Payment Status</div>
                      <div style="font-size: 10px; color: #334155; line-height: 1.4;">
                        <strong>Method:</strong> ${paymentMethod}<br>
                        <strong>Status:</strong> <span style="color: #059669; font-weight: 700;">● ${paymentStatus}</span>
                        ${transactionId ? '<br><strong style="font-size: 8.5px; color: #64748b;">TxID: ' + transactionId + '</strong>' : ''}
                      </div>
                    </div>
                  </td>
                  <td style="vertical-align: top; width: 50%;">
                    <div class="details-card" style="padding: 8px 10px; min-height: 28mm; border-left: 2px solid #8b5cf6; margin-bottom: 0;">
                      <div class="card-title" style="font-size: 10px; color: #8b5cf6; border-bottom: 1px solid #f5f3ff; margin-bottom: 4px; padding-bottom: 2px;">Delivery Logistics</div>
                      <div style="font-size: 10px; color: #334155; line-height: 1.4;">
                        <strong>Date:</strong> ${deliveryDate}<br>
                        <strong>Slot:</strong> ${shipping.timeSlot || 'Standard Delivery'}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              ${(shipping.cardMessage || shipping.giftMessage) ? `
                <div class="details-card" style="border: 1px dashed #c5a880; background: #fffdf5; padding: 8px 10px; margin-bottom: 0;">
                  <div class="card-title" style="font-size: 10px; color: #c5a880; border-bottom: 1px dashed #fed7aa; margin-bottom: 4px;">💌 Card Message</div>
                  <div style="font-size: 10px; font-style: italic; color: #475569; line-height: 1.3;">
                    "${shipping.cardMessage || shipping.giftMessage}"
                  </div>
                </div>
              ` : ''}
            </td>
            <td style="width: 5%;"></td>
            <td style="width: 40%; vertical-align: top;">
              <!-- PRICING SUMMARY -->
              <table style="font-size: 11px; line-height: 1.5;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">${formatCurrency(itemsSubtotal, order.currency)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Delivery Fee:</td>
                  <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">
                    ${order.isFirstOrderFreeDelivery 
                      ? `FREE (${formatCurrency((order.shippingDetails?.timeSlot === 'midnight' ? 300 : 150) * (order.currencyRate || 1), order.currency)} waived)` 
                      : (hasDeliveryFee ? formatCurrency(deliveryFee, order.currency) : 'FREE')}
                  </td>
                </tr>
                ${hasPromo ? `
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Promo Discount${order.promoCode?.code ? ' (' + order.promoCode.code + ')' : ''}:</td>
                  <td style="padding: 4px 0; text-align: right; color: #dc2626; font-weight: 600;">-${formatCurrency(promoDiscount, order.currency)}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 2px solid #064e3b;">
                  <td style="padding: 8px 0; font-weight: 700; font-size: 13px; color: #064e3b;">Grand Total:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 13px; color: #064e3b;">${formatCurrency(grandTotal, order.currency)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- FOOTER -->
        <div class="invoice-footer">
          <div style="font-weight: 700; color: #064e3b; margin-bottom: 2px; font-size: 11px;">Thank you for choosing Spring Blossoms Florist.</div>
          <div class="footer-text">
            We design premium floral arrangements and curated gift solutions to make your moments unforgettable.<br>
            For any queries or modifications to your delivery, please contact +91 9949683222 or email contact@sbflorist.in.<br>
            This is a computer-generated invoice and requires no signature.
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
};


// Generate delivery confirmation email template with invoice
const generateDeliveryConfirmationWithInvoiceEmail = (orderData) => {
  const { order, customer, partner, proofImageUrl } = orderData;
  const items = order.items || [];

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

  const invoiceNumber = `INV-${order.orderNumber}`;
  const orderDate = formatDate(order.createdAt);
  const deliveryDate = formatDate(order.shippingDetails?.deliveryDate || new Date());
  const deliveryTimeSlot = formatTime(order.shippingDetails?.timeSlot);

  const paymentMethod = order.paymentDetails?.method || 'Online Payment';
  const paymentStatus = order.paymentDetails?.status || 'Completed';
  const paymentId = order.paymentDetails?.paymentId || order.paymentDetails?.razorpayPaymentId;

  const deliveryName = order.shippingDetails?.fullName || customer.name || 'Customer';
  const deliveryPhone = order.shippingDetails?.phone || customer.phone || 'N/A';
  const deliveryAddress = order.shippingDetails?.address || '';
  const deliveryApartment = order.shippingDetails?.apartment || '';
  const deliveryCity = order.shippingDetails?.city || '';
  const deliveryState = order.shippingDetails?.state || '';
  const deliveryZip = order.shippingDetails?.zipCode || '';

  const itemRows = items.map((item) => {
    const productName = item.product?.name || item.product?.title || item.title || 'Product';
    const unitPrice = item.finalPrice || item.price || 0;
    const lineTotal = unitPrice * item.quantity;

    return `
      <tr>
        <td class="cell cell-item">
          <div class="item-title">${productName}</div>
          ${item.product?.sku ? `<div class="item-sub">SKU: ${item.product.sku}</div>` : ''}
        </td>
        <td class="cell cell-center">${item.quantity}</td>
        <td class="cell cell-right">${formatCurrency(unitPrice, order.currency)}</td>
        <td class="cell cell-right">${formatCurrency(lineTotal, order.currency)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <title>Delivery Confirmation & Invoice - Spring Blossoms Florist</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #f6f8fb;
            font-family: Arial, Helvetica, sans-serif;
            color: #223046;
          }
          table {
            border-spacing: 0;
            border-collapse: collapse;
          }
          .wrapper {
            width: 100%;
            background: radial-gradient(circle at top left, #ecfdf5 0%, #f6f8fb 38%, #f6f8fb 100%);
            padding: 26px 12px;
          }
          .container {
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e7edf3;
            border-radius: 18px;
            overflow: hidden;
          }
          .hero {
            background: linear-gradient(136deg, #0f8b69 0%, #13795f 50%, #145f4d 100%);
            color: #ffffff;
            padding: 34px 30px 26px;
          }
          .hero h1 {
            margin: 0 0 8px;
            font-size: 30px;
            line-height: 1.2;
            font-weight: 700;
          }
          .hero p {
            margin: 0;
            font-size: 15px;
            line-height: 1.5;
            color: #d9f9ee;
          }
          .section {
            padding: 0 30px;
          }
          .status-card {
            margin: 24px 30px 0;
            background: linear-gradient(180deg, #f0fdf7 0%, #ebfaf3 100%);
            border: 1px solid #b9ebd5;
            border-radius: 14px;
            padding: 18px;
          }
          .status-title {
            margin: 0;
            color: #0f6e53;
            font-size: 20px;
            font-weight: 700;
          }
          .status-sub {
            margin: 8px 0 0;
            color: #32715d;
            font-size: 14px;
          }
          .meta-grid {
            margin-top: 16px;
            width: 100%;
          }
          .meta-box {
            background: #f8fbff;
            border: 1px solid #e4ebf3;
            border-radius: 12px;
            padding: 14px;
            width: 48.6%;
            vertical-align: top;
          }
          .meta-label {
            display: block;
            color: #5d728d;
            font-size: 11px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-weight: 700;
          }
          .meta-value {
            color: #1f2f45;
            font-size: 14px;
            line-height: 1.45;
            font-weight: 600;
          }
          .divider {
            height: 1px;
            background: #e8edf4;
            margin: 24px 0;
          }
          .invoice-head {
            margin: 22px 30px 8px;
            background: #f8fafc;
            border: 1px solid #e8edf3;
            border-radius: 14px;
            padding: 16px;
          }
          .invoice-title {
            margin: 0;
            font-size: 21px;
            color: #12273f;
            font-weight: 700;
          }
          .invoice-sub {
            margin: 6px 0 0;
            font-size: 13px;
            color: #5e7088;
          }
          .table-wrap {
            margin: 16px 30px 0;
            border: 1px solid #e5ebf2;
            border-radius: 12px;
            overflow: hidden;
          }
          .items-table {
            width: 100%;
            table-layout: fixed;
          }
          .items-table th {
            background: #eef4fa;
            color: #2c425c;
            font-size: 12px;
            letter-spacing: 0.3px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 12px 10px;
            border-bottom: 1px solid #e1e8f0;
          }
          .cell {
            padding: 12px 10px;
            border-bottom: 1px solid #ebf0f6;
            color: #24344b;
            font-size: 14px;
            vertical-align: top;
          }
          .cell-item {
            width: 50%;
          }
          .cell-center {
            text-align: center;
          }
          .cell-right {
            text-align: right;
            white-space: nowrap;
          }
          .item-title {
            font-weight: 700;
            color: #1e314a;
            line-height: 1.3;
          }
          .item-sub {
            margin-top: 4px;
            font-size: 11px;
            color: #6f7f93;
          }
          .summary {
            margin: 16px 30px 0;
            border: 1px solid #e5ebf2;
            border-radius: 12px;
            padding: 14px 16px;
            background: #ffffff;
          }
          .sum-row {
            width: 100%;
            font-size: 14px;
            color: #2b4059;
            margin-bottom: 7px;
          }
          .sum-row td {
            padding: 5px 0;
          }
          .sum-label {
            color: #60758f;
          }
          .sum-value {
            text-align: right;
            font-weight: 600;
            white-space: nowrap;
          }
          .grand {
            margin-top: 8px;
            border-top: 1px dashed #d3dde9;
            padding-top: 10px;
          }
          .grand td {
            font-size: 17px;
            font-weight: 700;
            color: #0f6e53;
          }
          .pay-card {
            margin: 16px 30px 0;
            border: 1px solid #d9eaf9;
            border-radius: 12px;
            background: #f4faff;
            padding: 14px 16px;
          }
          .pay-card h4 {
            margin: 0 0 8px;
            font-size: 15px;
            color: #1e3d5f;
          }
          .pay-card p {
            margin: 5px 0;
            font-size: 13px;
            color: #375778;
          }
          .footer {
            margin-top: 24px;
            background: #f8fafc;
            border-top: 1px solid #e7edf3;
            padding: 24px 30px 28px;
            text-align: center;
          }
          .footer h3 {
            margin: 0;
            font-size: 19px;
            color: #1a324d;
          }
          .footer p {
            margin: 8px 0 0;
            color: #60758f;
            font-size: 13px;
            line-height: 1.6;
          }
          .footer .contact {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid #e3eaf2;
            color: #3f5f7e;
            font-weight: 600;
          }
          .footer .small {
            margin-top: 10px;
            font-size: 11px;
            color: #8b9db2;
          }
          @media only screen and (max-width: 640px) {
            .wrapper { padding: 10px; }
            .hero { padding: 24px 18px; }
            .hero h1 { font-size: 24px; }
            .section { padding: 0 18px; }
            .status-card,
            .invoice-head,
            .table-wrap,
            .summary,
            .pay-card,
            .footer { margin-left: 18px; margin-right: 18px; }
            .status-card,
            .invoice-head,
            .summary,
            .pay-card,
            .footer { padding-left: 14px; padding-right: 14px; }
            .meta-box {
              width: 100% !important;
              display: block;
              margin-bottom: 10px;
            }
            .items-table th,
            .cell {
              font-size: 12px;
              padding: 10px 7px;
            }
            .cell-item { width: 42%; }
            .sum-row,
            .sum-row td { font-size: 13px; }
            .grand td { font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="hero">
              <h1>Order Delivered Successfully</h1>
              <p>Thank you for choosing Spring Blossoms Florist. Your delivery has been completed and your invoice is attached for easy reference.</p>
            </div>

            <div class="status-card">
              <p class="status-title">Delivery Completed</p>
              <p class="status-sub">Your order was delivered on ${formatDate(new Date())}. We hope your flowers brought joy.</p>
            </div>

            ${partner ? `
            <div style="margin: 16px 30px 0; border: 1px solid #ccece6; border-radius: 12px; background-color: #f2fbf9; padding: 14px 16px; font-size: 13px;">
              <h4 style="margin: 0 0 6px; font-size: 15px; color: #0b5e47;">Delivery Partner Information</h4>
              <p style="margin: 3px 0; color: #1e3d35;"><strong>Name:</strong> ${partner.name}</p>
              ${partner.vehicleType ? `<p style="margin: 3px 0; color: #1e3d35;"><strong>Vehicle:</strong> ${partner.vehicleType.toUpperCase()}</p>` : ''}
              ${proofImageUrl ? `
                <div style="margin-top: 10px; border-top: 1px dashed #ccece6; padding-top: 10px;">
                  <strong style="font-size: 13px; color: #0b5e47; display: block; margin-bottom: 8px;">Delivery Proof Photo:</strong>
                  <img src="${proofImageUrl}" alt="Delivery Proof" style="max-width: 100%; max-height: 250px; border-radius: 8px; border: 1px solid #ccece6;" />
                </div>
              ` : ''}
            </div>
            ` : ''}

            <div style="margin: 20px 30px 0; text-align: center;">
              <a href="${getFrontendUrl()}/profile?tab=orders" style="display: inline-block; background-color: #0f8b69; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Rate Your Experience</a>
            </div>

            <table class="meta-grid section" role="presentation">
              <tr>
                <td class="meta-box">
                  <span class="meta-label">Invoice</span>
                  <span class="meta-value">${invoiceNumber}</span>
                </td>
                <td style="width:2.8%"></td>
                <td class="meta-box">
                  <span class="meta-label">Order Number</span>
                  <span class="meta-value">${order.orderNumber}</span>
                </td>
              </tr>
              <tr>
                <td class="meta-box">
                  <span class="meta-label">Order Date</span>
                  <span class="meta-value">${orderDate}</span>
                </td>
                <td style="width:2.8%"></td>
                <td class="meta-box">
                  <span class="meta-label">Delivery Slot</span>
                  <span class="meta-value">${deliveryDate} • ${deliveryTimeSlot}</span>
                </td>
              </tr>
            </table>

            <div class="invoice-head">
              <p class="invoice-title">Invoice</p>
              <p class="invoice-sub">Spring Blossoms Florist • Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32, Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028</p>
              <p class="invoice-sub">Phone: 9949683222 • Email: contact@sbflorist.in • ${getFrontendUrl().replace(/^https?:\/\//, '')}</p>
            </div>

            <table class="meta-grid section" role="presentation">
              <tr>
                <td class="meta-box">
                  <span class="meta-label">Delivery Address</span>
                  <span class="meta-value">
                    ${deliveryName}<br>
                    ${deliveryAddress}${deliveryApartment ? `<br>${deliveryApartment}` : ''}<br>
                    ${deliveryCity}, ${deliveryState} ${deliveryZip}<br>
                    ${deliveryPhone}
                  </span>
                </td>
                <td style="width:2.8%"></td>
                <td class="meta-box">
                  <span class="meta-label">Customer</span>
                  <span class="meta-value">
                    ${customer.name || deliveryName}<br>
                    ${customer.email || 'N/A'}${customer.phone ? `<br>${customer.phone}` : ''}
                  </span>
                </td>
              </tr>
            </table>

            <div class="table-wrap">
              <table class="items-table" role="presentation">
                <thead>
                  <tr>
                    <th style="text-align:left; width:50%;">Item</th>
                    <th style="text-align:center; width:14%;">Qty</th>
                    <th style="text-align:right; width:18%;">Unit Price</th>
                    <th style="text-align:right; width:18%;">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </div>

            <div class="summary">
              <table class="sum-row" role="presentation">
                <tr>
                  <td class="sum-label">Subtotal</td>
                  <td class="sum-value">${formatCurrency(itemsSubtotal, order.currency)}</td>
                </tr>
                ${hasShipping ? `
                  <tr>
                    <td class="sum-label">Delivery Charges</td>
                    <td class="sum-value">${formatCurrency(shippingCharges, order.currency)}</td>
                  </tr>
                  <tr>
                    <td class="sum-label">Tax (CGST + SGST)</td>
                    <td class="sum-value">${formatCurrency(cgst + sgst, order.currency)}</td>
                  </tr>
                ` : ''}
                <tr class="grand">
                  <td>Grand Total</td>
                  <td class="sum-value">${formatCurrency(grandTotal, order.currency)}</td>
                </tr>
              </table>
            </div>

            <div class="pay-card">
              <h4>Payment Information</h4>
              <p><strong>Method:</strong> ${paymentMethod}</p>
              <p><strong>Status:</strong> ${paymentStatus}</p>
              ${paymentId ? `<p><strong>Transaction ID:</strong> ${paymentId}</p>` : ''}
            </div>

            <div class="footer">
              <h3>Thank you for your order</h3>
              <p>We appreciate your trust in Spring Blossoms Florist and hope your arrangement made the moment special.</p>
              <p class="contact">contact@sbflorist.in • 9949683222 • Monday - Saturday, 9 AM - 6 PM IST</p>
              <p class="small">Terms and conditions apply. Return and refund policy: www.sbflorist.in/returns</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Send delivery confirmation email with invoice
const sendDeliveryConfirmationWithInvoice = async (orderData) => {
  console.log(`\n[Delivery Confirmation Email Trigger] 🚚 Triggered sendDeliveryConfirmationWithInvoice`);
  try {
    const { customer, order } = orderData;

    const { checkIsPlaceholderCustomer } = require('../utils/testCustomerHelper');
    const check = checkIsPlaceholderCustomer(orderData);
    if (check.isPlaceholder) {
      console.log(`Customer notifications skipped:\nReason: ${check.reason}\nOrder: ${order?.orderNumber || 'Unknown'}\nEmail: ${customer?.email || 'N/A'}`);
      return { success: true, message: 'Skipped delivery confirmation email for placeholder customer.' };
    }
    
    if (!customer) {
      console.error(`[Delivery Confirmation Email Trigger] ❌ Customer object is missing in orderData`);
      return { success: false, error: 'No customer data provided' };
    }
    if (!order) {
      console.error(`[Delivery Confirmation Email Trigger] ❌ Order object is missing in orderData`);
      return { success: false, error: 'No order data provided' };
    }

    console.log(`[Delivery Confirmation Email Trigger]   Order Number: ${order.orderNumber}`);
    console.log(`[Delivery Confirmation Email Trigger]   Customer Name: ${customer.name}`);
    console.log(`[Delivery Confirmation Email Trigger]   Customer Email: ${customer.email}`);
    console.log(`[Delivery Confirmation Email Trigger]   Customer Phone: ${customer.phone}`);

    if (!customer.email) {
      console.warn(`[Delivery Confirmation Email Trigger] ⚠️ Skipping delivery email: No customer email address provided`);
      return { success: false, error: 'No customer email address provided' };
    }

    console.log('📄 Generating PDF invoice...');
    
    // Generate HTML for email body (delivery confirmation wrapper + invoice)
    console.log('[Delivery Confirmation Email Trigger] Generating HTML body template...');
    const htmlContent = generateDeliveryConfirmationWithInvoiceEmail(orderData);

    let pdfBuffer = null;
    try {
      // Generate standalone invoice HTML for the PDF attachment (uses the new unified template)
      console.log('[Delivery Confirmation Email Trigger] Generating standalone Invoice HTML template...');
      const invoiceHTML = generateInvoiceHTML(orderData);

      // Generate PDF from the standalone invoice template
      console.log('[Delivery Confirmation Email Trigger] Rendering PDF buffer via generateInvoicePDF...');
      pdfBuffer = await generateInvoicePDF(invoiceHTML, order.orderNumber);
      console.log('✅ PDF invoice generated successfully');
    } catch (pdfErr) {
      console.error('[Delivery Confirmation Email Trigger] ❌ PDF Invoice generation failed, falling back to sending email without attachment:', pdfErr.message);
      if (pdfErr.stack) {
        console.error('[Delivery Confirmation Email Trigger] PDF Error Stack:', pdfErr.stack);
      }
    }

    console.log('[Delivery Confirmation Email Trigger] Attempting to send email via sendEmail...');

    const emailOptions = {
      to: customer.email,
      cc: '2006sbf@gmail.com', // Send copy to business email
      subject: `🎉 Order Delivered & Invoice #INV-${order.orderNumber} - Spring Blossoms Florist`,
      html: htmlContent,
      type: 'delivered',
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

        ${pdfBuffer ? 'Please find your detailed invoice attached as a PDF.' : ''}

        For any questions, please contact us at contact@sbflorist.in or call 9949683222.

        Best regards,
        Spring Blossoms Florist Team`
    };

    if (pdfBuffer) {
      emailOptions.attachments = [
        {
          filename: `Invoice-${order.orderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];
    } else {
      emailOptions.subject = `🎉 Order Delivered #INV-${order.orderNumber} - Spring Blossoms Florist`;
    }

    const result = await sendEmail(emailOptions);

    if (result.success) {
      if (pdfBuffer) {
        console.log('✅ Delivery confirmation email with PDF invoice sent successfully:', result.messageId);
      } else {
        console.log('✅ Delivery confirmation email sent successfully (fallback, without PDF invoice):', result.messageId);
      }
    } else {
      console.error('❌ Failed to send delivery confirmation email:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send delivery confirmation email:', error);
    if (error.stack) {
      console.error('❌ Error stack:', error.stack);
    }
    return { success: false, error: error.message };
  }
};

// Send email notification to both customer and admin
const sendEmailNotification = async (orderData) => {
  const results = [];

  try {
    const { customer, order } = orderData;

    // Send email to customer
    const { checkIsPlaceholderCustomer } = require('../utils/testCustomerHelper');
    const check = checkIsPlaceholderCustomer(orderData);
    
    if (check.isPlaceholder) {
      console.log(`Customer notifications skipped:\nReason: ${check.reason}\nOrder: ${order.orderNumber}\nEmail: ${customer.email || 'N/A'}`);
      results.push({
        type: 'customer',
        success: true,
        message: 'Skipped customer confirmation email for placeholder customer.',
        recipient: customer.email
      });
    } else if (customer.email) {
      try {
        const customerResult = await sendEmail({
          to: customer.email,
          subject: `🎉 Order Confirmed #${order.orderNumber} - Spring Blossoms Florist`,
          html: generateOrderConfirmationEmail(orderData),
          type: 'order_confirmation',
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
        });

        if (customerResult.success) {
          console.log('✅ Customer email sent successfully to:', customer.email);
          results.push({
            type: 'customer',
            success: true,
            messageId: customerResult.messageId,
            recipient: customer.email
          });
        } else {
          throw new Error(customerResult.error);
        }
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
      const adminResult = await sendEmail({
        to: adminEmail,
        subject: `🚨 New Order Alert #${order.orderNumber} - ${formatCurrency(order.totalAmount, order.currency)}`,
        html: generateAdminOrderNotificationEmail(orderData),
        type: 'order_confirmation',
        fromNameOverride: 'Spring Blossoms Florist Order System',
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
      });

      if (adminResult.success) {
        console.log('✅ Admin email sent successfully to:', adminEmail);
        results.push({
          type: 'admin',
          success: true,
          messageId: adminResult.messageId,
          recipient: adminEmail
        });
      } else {
        throw new Error(adminResult.error);
      }
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
const testEmailService = async (req, res) => {
  console.log('🧪 Testing email services...');
  try {
    const transporter = require('./emailService').getTransporter();
    await transporter.verify();
    res.json({
      success: true,
      message: 'SMTP connection verified successfully.'
    });
  } catch (error) {
    console.error('❌ SMTP verification failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send test email
const sendTestEmail = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Recipient email is required' });
    }

    const testType = type || 'order'; // 'order', 'delivery', 'review', 'contact'
    let subject = '';
    let html = '';
    let text = '';
    let emailTypeKey = 'order_confirmation';

    if (testType === 'delivery') {
      emailTypeKey = 'delivered';
      subject = '🚚 [Test] Out for Delivery - Spring Blossoms Florist';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; border-bottom: 2px solid #0f8b69; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #0f8b69; margin: 0;">Spring Blossoms Florist</h1>
            <p style="margin: 5px 0 0; font-style: italic; color: #666; font-size: 14px;">A Reason to Express</p>
          </div>
          <h2>Test Delivery Notification</h2>
          <p>This is a test notification for the delivery flow. Your delivery configuration is working correctly.</p>
          <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
            <p>Spring Blossoms Florist</p>
            <p>Website: <a href="https://sbflorist.in" style="color: #0f8b69; text-decoration: none;">https://sbflorist.in</a> | Email: <a href="mailto:contact@sbflorist.in" style="color: #0f8b69; text-decoration: none;">contact@sbflorist.in</a></p>
            <p>Thank you for choosing Spring Blossoms Florist.</p>
          </div>
        </div>
      `;
      text = 'Test Delivery Notification from Spring Blossoms Florist';
    } else if (testType === 'review') {
      emailTypeKey = 'review_request';
      subject = '⭐ [Test] Share your review - Spring Blossoms Florist';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; border-bottom: 2px solid #bd7260; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #bd7260; margin: 0;">Spring Blossoms Florist</h1>
            <p style="margin: 5px 0 0; font-style: italic; color: #666; font-size: 14px;">A Reason to Express</p>
          </div>
          <h2>Test Review Request</h2>
          <p>This is a test notification for the review request flow. Your review configuration is working correctly.</p>
          <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
            <p>Spring Blossoms Florist</p>
            <p>Website: <a href="https://sbflorist.in" style="color: #bd7260; text-decoration: none;">https://sbflorist.in</a> | Email: <a href="mailto:contact@sbflorist.in" style="color: #bd7260; text-decoration: none;">contact@sbflorist.in</a></p>
            <p>Thank you for choosing Spring Blossoms Florist.</p>
          </div>
        </div>
      `;
      text = 'Test Review Request from Spring Blossoms Florist';
    } else if (testType === 'contact') {
      emailTypeKey = 'contact_form_reply';
      subject = '✉️ [Test] Contact Us Reply - Spring Blossoms Florist';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; border-bottom: 2px solid #8a5a51; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #8a5a51; margin: 0;">Spring Blossoms Florist</h1>
            <p style="margin: 5px 0 0; font-style: italic; color: #666; font-size: 14px;">A Reason to Express</p>
          </div>
          <h2>Test Contact Us Reply</h2>
          <p>This is a test notification for the contact flow. Your contact configuration is working correctly.</p>
          <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
            <p>Spring Blossoms Florist</p>
            <p>Website: <a href="https://sbflorist.in" style="color: #8a5a51; text-decoration: none;">https://sbflorist.in</a> | Email: <a href="mailto:contact@sbflorist.in" style="color: #8a5a51; text-decoration: none;">contact@sbflorist.in</a></p>
            <p>Thank you for choosing Spring Blossoms Florist.</p>
          </div>
        </div>
      `;
      text = 'Test Contact Us Reply from Spring Blossoms Florist';
    } else {
      // order
      emailTypeKey = 'order_confirmation';
      subject = '🎉 [Test] Order Confirmation - Spring Blossoms Florist';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #667eea; margin: 0;">Spring Blossoms Florist</h1>
            <p style="margin: 5px 0 0; font-style: italic; color: #666; font-size: 14px;">A Reason to Express</p>
          </div>
          <h2>Test Order Confirmation</h2>
          <p>This is a test notification for the order placement flow. Your order confirmation configuration is working correctly.</p>
          <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
            <p>Spring Blossoms Florist</p>
            <p>Website: <a href="https://sbflorist.in" style="color: #667eea; text-decoration: none;">https://sbflorist.in</a> | Email: <a href="mailto:contact@sbflorist.in" style="color: #667eea; text-decoration: none;">contact@sbflorist.in</a></p>
            <p>Thank you for choosing Spring Blossoms Florist.</p>
          </div>
        </div>
      `;
      text = 'Test Order Confirmation from Spring Blossoms Florist';
    }

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      type: emailTypeKey
    });

    if (result.success) {
      res.json({ success: true, messageId: result.messageId, response: result.response });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get email configuration status
const getEmailConfig = (req, res) => {
  res.json({
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: (process.env.SMTP_USER || '2006sbf@gmail.com').replace(/(.{3}).*@/, '$1***@'),
    emailFrom: process.env.EMAIL_FROM ? process.env.EMAIL_FROM.replace(/(.{3}).*@/, '$1***@') : 'NOT CONFIGURED',
    frontendUrl: process.env.FRONTEND_URL || 'https://sbflorist.in',
    senderAddresses: {
      orders: process.env.MAIL_FROM_ORDER || 'orderconfirmation@sbflorist.in',
      delivery: process.env.MAIL_FROM_DELIVERY || 'deliveryconfirmation@sbflorist.in',
      reviews: process.env.MAIL_FROM_REVIEW || 'review@sbflorist.in',
      contact: process.env.MAIL_FROM_CONTACT || 'contact@sbflorist.in'
    }
  });
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
  sendDeliveryConfirmationWithInvoice,
  generateInvoiceHTML,
  generateInvoicePDF
};
