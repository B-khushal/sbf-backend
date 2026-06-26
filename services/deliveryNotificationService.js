const twilio = require('twilio');
const DeviceToken = require('../models/DeviceToken');
const fcmService = require('./fcmService');
const { sendEmail } = require('./emailService');

// Initialize Twilio
let twilioClient = null;
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};

if (TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken && TWILIO_CONFIG.phoneNumber) {
  try {
    twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
    console.log('✅ Twilio service initialized successfully in Delivery Notification Service');
  } catch (error) {
    console.error('❌ Failed to initialize Twilio service in Delivery Notification:', error);
  }
} else {
  console.warn('⚠️ Twilio credentials missing. SMS and WhatsApp delivery notifications will be logged to console.');
}

const getFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || 'https://sbflorist.in';
  if (url.includes('onrender.com')) {
    return 'https://sbflorist.in';
  }
  return url;
};

// Generic SMS Sender
const sendSMS = async (to, body) => {
  if (!to) return { success: false, error: 'No recipient phone number' };
  
  const formattedPhone = to.startsWith('+') ? to : `+91${to}`; // Assume India default if not prefixed
  
  if (twilioClient) {
    try {
      const message = await twilioClient.messages.create({
        body,
        from: TWILIO_CONFIG.phoneNumber,
        to: formattedPhone
      });
      console.log(`[SMS] Sent successfully: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('[SMS] Failed to send:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.log(`[SMS MOCK] To: ${formattedPhone} | Body: ${body}`);
    return { success: true, mock: true };
  }
};

// Generic WhatsApp Sender
const sendWhatsApp = async (to, body) => {
  if (!to) return { success: false, error: 'No recipient phone number' };
  
  const formattedPhone = to.startsWith('+') ? to : `+91${to}`;
  
  if (twilioClient) {
    try {
      const message = await twilioClient.messages.create({
        body,
        from: `whatsapp:${TWILIO_CONFIG.phoneNumber}`,
        to: `whatsapp:${formattedPhone}`
      });
      console.log(`[WhatsApp] Sent successfully: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('[WhatsApp] Failed to send:', error);
      return { success: false, error: error.message };
    }
  } else {
    console.log(`[WhatsApp MOCK] To: whatsapp:${formattedPhone} | Body: ${body}`);
    return { success: true, mock: true };
  }
};

// Generic FCM Push Sender
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const tokens = await DeviceToken.find({ userId, isActive: true });
    if (!tokens || tokens.length === 0) {
      console.log(`[FCM] No active device tokens found for user/partner ${userId}`);
      return { success: false, reason: 'No tokens found' };
    }
    
    const results = await Promise.all(
      tokens.map(async (t) => {
        try {
          const res = await fcmService.sendPushNotification(t.token, { title, body }, data);
          if (!res.success && (res.error === 'messaging/invalid-registration-token' || res.error === 'messaging/registration-token-not-registered')) {
            // Cleanup invalid token
            await DeviceToken.deleteOne({ token: t.token });
            console.log(`[FCM] Deleted invalid token for user ${userId}`);
          }
          return res;
        } catch (e) {
          return { success: false, error: e.message };
        }
      })
    );
    return { success: true, results };
  } catch (error) {
    console.error('[FCM] Send error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Dispatches delivery-related notifications based on the event-channel matrix.
 * @param {string} event - Notification event type (order_assigned, partner_assigned, order_picked_up, out_for_delivery, delivered, delivery_failed, rescheduled, cancelled)
 * @param {Object} assignment - DeliveryAssignment document
 * @param {Object} order - Order document
 * @param {Object} partner - DeliveryPartner document (optional)
 */
const sendDeliveryNotification = async (event, assignment, order, partner = null) => {
  try {
    const customerName = order.shippingDetails?.fullName || 'Customer';
    const customerPhone = order.shippingDetails?.phone || order.giftDetails?.recipientPhone;
    const customerEmail = order.shippingDetails?.email || order.giftDetails?.recipientEmail;
    const orderNumber = order.orderNumber;
    const trackingUrl = `${getFrontendUrl()}/track/${orderNumber}`;
    
    console.log(`Sending delivery notification: [${event}] for Order #${orderNumber}`);

    switch (event) {
      case 'order_assigned':
        // MATRIX: Email: NO, WhatsApp: NO, Push: PARTNER ONLY
        if (partner) {
          await sendPushNotification(
            partner._id,
            'New Order Request 🌸',
            `Order #${orderNumber} is available for pickup. Open app to accept.`,
            {
              type: 'new_request',
              assignmentId: assignment._id.toString(),
              orderId: order._id.toString()
            }
          );
        }
        break;

      case 'partner_assigned':
        // MATRIX: Email: YES, WhatsApp: NO, Push: CUSTOMER
        if (customerEmail) {
          const partnerDetailsStr = partner ? `${partner.name} (${partner.vehicleType})` : 'A delivery partner';
          const partnerPhoneStr = partner ? `Phone: ${partner.phone}` : '';
          
          await sendEmail({
            to: customerEmail,
            subject: `🚚 Delivery Partner Assigned for Order #${orderNumber} - Spring Blossoms Florist`,
            type: 'delivery_assigned',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; border-bottom: 2px solid #0f8b69; padding-bottom: 10px; margin-bottom: 20px;">
                  <h1 style="color: #0f8b69; margin: 0;">Spring Blossoms Florist</h1>
                  <p style="margin: 5px 0 0; font-style: italic; color: #666; font-size: 14px;">A Reason to Express</p>
                </div>
                <h2>Delivery Partner Assigned!</h2>
                <p>Hello ${customerName},</p>
                <p>We have assigned a delivery partner for your order <strong>#${orderNumber}</strong>.</p>
                <div style="background-color: #f4fbf7; border-left: 4px solid #0f8b69; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0 0 8px;"><strong>Delivery Partner Details:</strong></p>
                  <p style="margin: 0 0 5px;">Name: ${partnerDetailsStr}</p>
                  <p style="margin: 0;">${partnerPhoneStr}</p>
                </div>
                <p>Our partner is heading to the store to collect your beautiful arrangement. You will be notified once they pick up the order.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${trackingUrl}" style="background-color: #0f8b69; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Track Your Order Live</a>
                </div>
                <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
                  <p>Spring Blossoms Florist</p>
                  <p>Thank you for choosing Spring Blossoms Florist.</p>
                </div>
              </div>
            `,
            text: `Delivery Partner Assigned for Order #${orderNumber}.\nPartner: ${partnerDetailsStr} (${partnerPhoneStr}). Track live at: ${trackingUrl}`
          });
        }
        
        // Push Notification to Customer
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Delivery Partner Assigned 🚚',
            `Partner ${partner ? partner.name : ''} has been assigned to your order #${orderNumber}.`,
            { type: 'partner_assigned', orderId: order._id.toString() }
          );
        }
        break;

      case 'order_picked_up':
        // MATRIX: Email: NO, WhatsApp: YES, Push: CUSTOMER
        if (customerPhone) {
          const partnerName = partner ? partner.name : 'our partner';
          await sendWhatsApp(
            customerPhone,
            `Hi ${customerName}! 👋 Your Spring Blossoms Florist order #${orderNumber} has been picked up by our partner ${partnerName}. They are loading your arrangement carefully and heading to your location! 🚚`
          );
          // Standard SMS backup
          await sendSMS(
            customerPhone,
            `Spring Blossoms: Order #${orderNumber} has been picked up by our partner ${partnerName}. Track live: ${trackingUrl}`
          );
        }
        
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Order Picked Up 🛍️',
            `Our partner has collected your order #${orderNumber} and is heading out.`,
            { type: 'order_picked_up', orderId: order._id.toString() }
          );
        }
        break;

      case 'out_for_delivery':
        // MATRIX: Email: NO, WhatsApp: YES, Push: CUSTOMER
        if (customerPhone) {
          const partnerName = partner ? partner.name : 'our partner';
          await sendWhatsApp(
            customerPhone,
            `Hi ${customerName}! 👋 Your order #${orderNumber} is now OUT FOR DELIVERY with ${partnerName}! 🚀 Track their live location and estimated arrival in real-time here: ${trackingUrl}`
          );
          await sendSMS(
            customerPhone,
            `Spring Blossoms: Order #${orderNumber} is out for delivery! Track live location: ${trackingUrl}`
          );
        }
        
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Out for Delivery! 🚀',
            `Your arrangement is out for delivery. ETA is approx ${assignment.eta || 15} minutes.`,
            { type: 'out_for_delivery', orderId: order._id.toString() }
          );
        }
        break;

      case 'delivered':
        // MATRIX: Email: YES (with attachment pdf & feedback), WhatsApp: YES, Push: CUSTOMER
        // We will call the existing invoice helper inside the controller or route because it requires HTML-PDF buffers.
        // But we will send a backup custom HTML email here as well, and send WhatsApp/Push.
        if (customerPhone) {
          const partnerName = partner ? partner.name : 'our partner';
          await sendWhatsApp(
            customerPhone,
            `Hi ${customerName}! 💐 Great news! Your order #${orderNumber} has been successfully delivered by ${partnerName}. We hope it made the moment extra special! Rate your experience here: ${getFrontendUrl()}/profile?tab=orders`
          );
          await sendSMS(
            customerPhone,
            `Spring Blossoms: Order #${orderNumber} has been delivered successfully! Thank you for ordering.`
          );
        }
        
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Delivered! 💐',
            `Your order #${orderNumber} has been delivered successfully. Thank you!`,
            { type: 'delivered', orderId: order._id.toString() }
          );
        }
        break;

      case 'delivery_failed':
        // MATRIX: Email: YES, WhatsApp: YES, Push: CUSTOMER
        if (customerEmail) {
          const reasonText = assignment.failReason ? assignment.failReason.replace(/_/g, ' ') : 'recipient unavailable';
          await sendEmail({
            to: customerEmail,
            subject: `⚠️ Delivery Failed: Order #${orderNumber} - Spring Blossoms Florist`,
            type: 'delivery_failed',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; border-bottom: 2px solid #d9534f; padding-bottom: 10px; margin-bottom: 20px;">
                  <h1 style="color: #d9534f; margin: 0;">Spring Blossoms Florist</h1>
                </div>
                <h2>Delivery Attempt Unsuccessful</h2>
                <p>Hello ${customerName},</p>
                <p>Our partner tried to deliver your order <strong>#${orderNumber}</strong>, but was unsuccessful.</p>
                <p><strong>Reason:</strong> ${reasonText.toUpperCase()}</p>
                <p>We are holding the arrangement safely at the store. Please contact our support team at 9949683222 or email contact@sbflorist.in to reschedule your delivery.</p>
                <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
                  <p>Spring Blossoms Florist</p>
                </div>
              </div>
            `,
            text: `Delivery attempt unsuccessful for order #${orderNumber}. Reason: ${reasonText}. Please contact support.`
          });
        }
        
        if (customerPhone) {
          const reasonText = assignment.failReason ? assignment.failReason.replace(/_/g, ' ') : 'recipient unavailable';
          await sendWhatsApp(
            customerPhone,
            `Hi ${customerName}. We tried to deliver your order #${orderNumber}, but were unsuccessful (Reason: ${reasonText}). We are keeping your flowers fresh. Please contact us at 9949683222 to coordinate a redelivery time.`
          );
        }
        
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Delivery Attempt Failed ⚠️',
            `We couldn't deliver order #${orderNumber}. Tap for details.`,
            { type: 'delivery_failed', orderId: order._id.toString() }
          );
        }
        break;

      case 'rescheduled':
        // MATRIX: Email: NO, WhatsApp: NO, Push: CUSTOMER
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Delivery Rescheduled 📅',
            `Your order #${orderNumber} delivery has been rescheduled to ${order.shippingDetails?.deliveryDate ? new Date(order.shippingDetails.deliveryDate).toLocaleDateString() : 'a new slot'}.`,
            { type: 'rescheduled', orderId: order._id.toString() }
          );
        }
        break;

      case 'cancelled':
        // MATRIX: Email: YES, WhatsApp: NO, Push: CUSTOMER
        if (customerEmail) {
          await sendEmail({
            to: customerEmail,
            subject: `❌ Order Cancelled #${orderNumber} - Spring Blossoms Florist`,
            type: 'order_cancelled',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; border-bottom: 2px solid #555; padding-bottom: 10px; margin-bottom: 20px;">
                  <h1 style="color: #333; margin: 0;">Spring Blossoms Florist</h1>
                </div>
                <h2>Order Cancelled</h2>
                <p>Hello ${customerName},</p>
                <p>Your order <strong>#${orderNumber}</strong> and its delivery assignment have been cancelled.</p>
                <p>If you did not request this cancellation or have questions about a refund, please reply directly to this email or call us at 9949683222.</p>
                <div style="text-align: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
                  <p>Spring Blossoms Florist</p>
                </div>
              </div>
            `,
            text: `Order #${orderNumber} and its delivery assignment have been cancelled.`
          });
        }
        
        if (order.user) {
          await sendPushNotification(
            order.user,
            'Order Cancelled ❌',
            `Your order #${orderNumber} has been cancelled.`,
            { type: 'cancelled', orderId: order._id.toString() }
          );
        }
        break;

      default:
        console.warn(`Unknown delivery notification event: ${event}`);
    }
  } catch (err) {
    console.error(`Error sending delivery notification for ${event}:`, err);
  }
};

module.exports = {
  sendSMS,
  sendWhatsApp,
  sendPushNotification,
  sendDeliveryNotification
};
