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

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
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
  const activeTransporter = getTransporter();
  
  // Resolve correct From address based on email type
  let fromAddress = "";
  let fromName = fromNameOverride || "Spring Blossoms Florist";

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
        fromAddress = process.env.MAIL_FROM_ORDER || "orderconfirmation@sbflorist.in";
        if (type === "invoice") {
          fromName = fromNameOverride || "Spring Blossoms Florist Billing";
        }
        break;
      case "delivery_assigned":
      case "out_for_delivery":
      case "delivered":
      case "delivery_delay":
      case "delivery_reschedule":
        fromAddress = process.env.MAIL_FROM_DELIVERY || "deliveryconfirmation@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Delivery";
        break;
      case "review_request":
      case "review_reminder":
        fromAddress = process.env.MAIL_FROM_REVIEW || "review@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Reviews";
        break;
      case "contact_form_reply":
      case "contact_form_enquiry":
        fromAddress = process.env.MAIL_FROM_CONTACT || "contact@sbflorist.in";
        fromName = fromNameOverride || "Spring Blossoms Support";
        break;
      default:
        fromAddress = process.env.MAIL_FROM_CONTACT || "contact@sbflorist.in";
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

  let status = "failed";
  let smtpResponse = "";
  let errorMessage = "";
  let messageId = "";

  try {
    const result = await activeTransporter.sendMail(mailOptions);
    status = "success";
    smtpResponse = result.response || "Sent successfully";
    messageId = result.messageId || "";
    return {
      success: true,
      messageId,
      response: smtpResponse,
    };
  } catch (error) {
    status = "failed";
    errorMessage = error.message || "Unknown error";
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
