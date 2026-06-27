const nodemailer = require("nodemailer");
const EmailLog = require("../models/EmailLog");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true"; // false by default
    const user = process.env.SMTP_USER || "2006sbf@gmail.com";
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";

    console.log(`[SMTP Transporter Creation] 🛠️ Initializing Nodemailer SMTP transporter...`);
    console.log(`[SMTP Transporter Creation] Configuration: Host=${host}, Port=${port}, Secure=${secure}, User=${user}`);

    try {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
      console.log(`[SMTP Transporter Creation] ✅ Nodemailer SMTP transporter successfully created`);
    } catch (err) {
      console.error(`[SMTP Transporter Creation] ❌ Failed to create SMTP transporter:`, err);
      console.error(err.stack);
      throw err;
    }
  }
  return transporter;
};

/**
 * Send an email using the centralized email service.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Text fallback content
 * @param {string} options.type - Email type (e.g. 'order_confirmation', 'delivery_confirmation', 'review_request', 'contact_form')
 * @param {string} [options.cc] - Optional CC email
 * @param {string} [options.replyTo] - Optional Reply-To email
 * @param {Array} [options.attachments] - Optional attachments array
 * @param {string} [options.fromOverride] - Override sender address (e.g. for contact form submission)
 * @param {string} [options.fromNameOverride] - Override sender name (e.g. "Spring Blossoms Florist Billing")
 */
const sendEmail = async ({
  to,
  subject,
  html,
  text,
  type,
  cc,
  replyTo,
  attachments,
  fromOverride,
  fromNameOverride,
}) => {
  console.log(`\n[Email Service] 📤 getTransporter() called to retrieve SMTP transporter`);
  const activeTransporter = getTransporter();
  
  // Resolve correct From address based on email type
  let fromAddress = "";
  let fromName = fromNameOverride || "Spring Blossoms Florist";
  const emailFromEnv = process.env.EMAIL_FROM;

  if (fromOverride) {
    fromAddress = fromOverride;
  } else {
    switch (type) {
      case "order_confirmation":
      case "order_cancelled":
      case "invoice":
      case "payment_success":
      case "payment_failure":
      case "refund_notification":
        fromAddress = process.env.MAIL_FROM_ORDER || emailFromEnv || "orderconfirmation@sbflorist.in";
        if (type === "invoice") {
          fromName = fromNameOverride || "Spring Blossoms Florist Billing";
        }
        break;
      case "delivery_assigned":
      case "out_for_delivery":
      case "delivered":
      case "delivery_delay":
      case "delivery_reschedule":
        fromAddress = process.env.MAIL_FROM_DELIVERY || emailFromEnv || "deliveryconfirmation@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Delivery";
        break;
      case "review_request":
      case "review_reminder":
        fromAddress = process.env.MAIL_FROM_REVIEW || emailFromEnv || "review@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Reviews";
        break;
      case "contact_form_reply":
      case "contact_form_enquiry":
        fromAddress = process.env.MAIL_FROM_CONTACT || emailFromEnv || "contact@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Support";
        break;
      default:
        fromAddress = process.env.MAIL_FROM_CONTACT || emailFromEnv || "contact@sbflorist.in";
        break;
    }
  }

  const from = {
    name: fromName,
    address: fromAddress,
  };

  const mailOptions = {
    from,
    to,
    subject,
    html,
    text,
    attachments,
  };

  if (cc) mailOptions.cc = cc;
  if (replyTo) mailOptions.replyTo = replyTo;

  console.log(`[Email Service] 📧 Send Attempt details: Type="${type}", To="${to}", Subject="${subject}", CC="${cc || 'none'}"`);
  console.log(`[Email Service] Sender Address Resolved: "${from.name} <${from.address}>"`);
  if (attachments && attachments.length > 0) {
    console.log(`[Email Service] Attachments: ${attachments.length} file(s) present`);
    attachments.forEach((att, idx) => {
      console.log(`[Email Service]   Attachment #${idx + 1}: filename="${att.filename}", contentType="${att.contentType}", size=${att.content ? att.content.length : 0} bytes`);
    });
  }

  let status = "failed";
  let smtpResponse = "";
  let errorMessage = "";
  let messageId = "";

  try {
    console.log(`[Email Service] ⚡ Calling activeTransporter.sendMail...`);
    const result = await activeTransporter.sendMail(mailOptions);
    status = "success";
    smtpResponse = result.response || "Sent successfully";
    messageId = result.messageId || "";
    console.log(`[Email Service] ✅ Email Sent Successfully! Message ID="${messageId}", Response="${smtpResponse}"`);
    return {
      success: true,
      messageId,
      response: smtpResponse,
    };
  } catch (error) {
    // Check if it's a network/connection error that warrants fallback
    const isNetworkError = error.code === 'ETIMEDOUT' || 
                           error.code === 'ECONNREFUSED' || 
                           error.code === 'ENOTFOUND' || 
                           error.code === 'EHOSTUNREACH' ||
                           error.message.includes('timeout') ||
                           error.message.includes('connect') ||
                           error.message.includes('Greeting never received');
                           
    const primaryPort = parseInt(process.env.SMTP_PORT || "587", 10);
    
    if (isNetworkError) {
      const fallbackPort = primaryPort === 587 ? 465 : 587;
      const fallbackSecure = fallbackPort === 465;
      
      console.warn(`[Email Service] ⚠️ Primary SMTP Connection on Port ${primaryPort} failed: ${error.message}`);
      console.warn(`[Email Service] 🔄 Attempting automatic fallback to SMTP Port ${fallbackPort} (Secure=${fallbackSecure})...`);
      
      try {
        const host = process.env.SMTP_HOST || "smtp.gmail.com";
        const user = process.env.SMTP_USER || "2006sbf@gmail.com";
        const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
        
        const fallbackTransporter = nodemailer.createTransport({
          host,
          port: fallbackPort,
          secure: fallbackSecure,
          auth: {
            user,
            pass,
          },
        });
        
        console.log(`[Email Service] ⚡ Calling fallbackTransporter.sendMail on Port ${fallbackPort}...`);
        const result = await fallbackTransporter.sendMail(mailOptions);
        
        status = "success";
        smtpResponse = result.response || "Sent successfully via fallback";
        messageId = result.messageId || "";
        
        // Cache the fallback transporter so future email sends use it immediately
        transporter = fallbackTransporter;
        
        console.log(`[Email Service] ✅ Fallback Email Sent Successfully on Port ${fallbackPort}! Message ID="${messageId}", Response="${smtpResponse}"`);
        return {
          success: true,
          messageId,
          response: smtpResponse,
        };
      } catch (fallbackError) {
        console.error(`[Email Service] ❌ Fallback SMTP Attempt on Port ${fallbackPort} also failed:`, fallbackError);
      }
    }

    status = "failed";
    errorMessage = error.message || "Unknown error";
    console.error(`[Email Service] ❌ Email Send Failed for To="${to}":`, error);
    if (error.stack) {
      console.error(`[Email Service] Full Error Stack:`, error.stack);
    }
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Log the email to database
    try {
      await EmailLog.create({
        sender: `${from.name} <${from.address}>`,
        recipient: Array.isArray(to) ? to.join(", ") : to,
        subject,
        emailType: type,
        status,
        smtpResponse,
        errorMessage,
        timestamp: new Date(),
        metadata: {
          messageId,
          cc,
          replyTo,
          hasAttachments: !!(attachments && attachments.length),
        },
      });
    } catch (logError) {
      console.error("Failed to log outgoing email:", logError);
    }
  }
};

module.exports = {
  sendEmail,
  getTransporter
};
