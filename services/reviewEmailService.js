const { sendEmail } = require("./emailService");
const { buildReviewPublicUrl } = require("./reviewDomainService");

const REVIEW_EMAIL_USER =
  process.env.MAIL_FROM_REVIEW || "review@sbflorist.in";
const REVIEW_EMAIL_PASS = "";

const initReviewEmailTransporter = () => {
  return require("./emailService").getTransporter();
};

const floralShell = ({ preheader, heading, eyebrow, body, ctaHtml }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spring Blossoms Florist</title>
    <style>
      body { margin: 0; padding: 0; background: #f5efe8; font-family: Georgia, 'Times New Roman', serif; color: #2a2322; }
      .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; }
      .wrapper { width: 100%; padding: 24px 12px; }
      .card { max-width: 680px; margin: 0 auto; background: linear-gradient(180deg, #fffaf6 0%, #ffffff 100%); border-radius: 28px; overflow: hidden; box-shadow: 0 18px 40px rgba(55, 36, 23, 0.12); border: 1px solid rgba(148, 81, 69, 0.1); }
      .hero { padding: 36px 32px 28px; background: radial-gradient(circle at top left, rgba(184, 126, 110, 0.28), transparent 42%), linear-gradient(135deg, #fff5ee 0%, #f9e4db 100%); }
      .brand { font-size: 12px; letter-spacing: 0.34em; text-transform: uppercase; color: #8a5a51; font-weight: 700; margin-bottom: 16px; }
      .heading { font-size: 30px; line-height: 1.2; margin: 0 0 10px; color: #2e1d1a; }
      .sub { font-size: 15px; line-height: 1.8; color: #5d4b48; margin: 0; }
      .content { padding: 30px 32px 34px; }
      .section { margin-bottom: 28px; }
      .pill { display: inline-block; padding: 8px 14px; border-radius: 999px; background: #f8ece4; color: #7c4d43; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .cta { display: inline-block; background: linear-gradient(135deg, #8a4b3f 0%, #bd7260 100%); color: #ffffff !important; text-decoration: none; padding: 14px 22px; border-radius: 999px; font-weight: 700; box-shadow: 0 10px 24px rgba(138, 75, 63, 0.22); }
      .grid { display: grid; gap: 18px; }
      .product { border-radius: 22px; background: #fbf3ee; padding: 18px; border: 1px solid rgba(138, 75, 63, 0.08); }
      .product-table { width: 100%; border-collapse: collapse; }
      .product-image { width: 92px; height: 92px; border-radius: 18px; object-fit: cover; display: block; border: 1px solid rgba(138, 75, 63, 0.08); }
      .product-name { font-size: 18px; font-weight: 700; margin: 0 0 6px; color: #2d1f1d; }
      .meta { font-size: 13px; color: #765d58; line-height: 1.7; margin: 0; }
      .footer { padding: 22px 32px 34px; color: #816760; font-size: 13px; line-height: 1.7; }
      .divider { height: 1px; background: rgba(138, 75, 63, 0.1); margin: 0 32px; }
      @media (max-width: 620px) {
        .hero, .content, .footer { padding-left: 20px; padding-right: 20px; }
        .heading { font-size: 24px; }
        .product-table, .product-table tbody, .product-table tr, .product-table td { display: block; width: 100%; }
        .product-image { margin-bottom: 14px; }
      }
    </style>
  </head>
  <body>
    <div class="preheader">${preheader}</div>
    <div class="wrapper">
      <div class="card">
        <div class="hero">
          <div class="brand">Spring Blossoms Florist</div>
          <div style="font-size: 10px; color: #8a5a51; font-style: italic; margin-top: -12px; margin-bottom: 12px; letter-spacing: 0.1em; text-transform: uppercase;">A Reason to Express</div>
          <div class="pill">${eyebrow}</div>
          <h1 class="heading">${heading}</h1>
          <p class="sub">${body}</p>
        </div>
        <div class="content">
          ${ctaHtml || ""}
        </div>
        <div class="divider"></div>
        <div class="footer">
          <strong>Spring Blossoms Florist</strong><br />
          Website: <a href="https://sbflorist.in" style="color: #816760; text-decoration: underline;">https://sbflorist.in</a><br />
          Email: <a href="mailto:contact@sbflorist.in" style="color: #816760; text-decoration: underline;">contact@sbflorist.in</a><br />
          Thank you for choosing Spring Blossoms Florist.
        </div>
      </div>
    </div>
  </body>
</html>`;

const productCardHtml = ({ image, title, orderNumber, reviewUrl }) => `
  <div class="product">
    <table class="product-table" role="presentation">
      <tbody>
        <tr>
          <td style="width:110px; vertical-align:top;">
            <img src="${image}" alt="${title}" class="product-image" />
          </td>
          <td style="padding-left:18px; vertical-align:top;">
            <p class="product-name">${title}</p>
            <p class="meta">Order ID: <strong>${orderNumber}</strong></p>
            <p class="meta" style="margin: 10px 0 18px;">Your feedback helps other flower lovers shop with confidence.</p>
            <a class="cta" href="${reviewUrl}" target="_blank" rel="noopener noreferrer">Write a Review</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
`;

const sendMail = async ({ to, subject, html, text, cc }) => {
  try {
    const result = await sendEmail({
      to,
      cc,
      subject,
      html,
      text,
      type: "review_request"
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const sendReviewRequestEmail = async ({ customer, order, products }) => {
  const cards = products
    .map((product) =>
      productCardHtml({
        image: product.image,
        title: product.title,
        orderNumber: order.orderNumber,
        reviewUrl: product.reviewUrl || buildReviewPublicUrl(product, order._id),
      })
    )
    .join("");

  const html = floralShell({
    preheader: `Share your review for order ${order.orderNumber}`,
    eyebrow: "Review Invitation",
    heading: `How did your floral experience feel, ${customer.name}?`,
    body: "Your order was delivered, and we would love to hear about the bouquet quality, freshness, and delivery experience.",
    ctaHtml: `
      <div class="section">
        <p class="meta" style="font-size:15px; color:#5d4b48; margin-bottom:18px;">
          Each review goes directly to the product's dedicated review page so your feedback stays attached to the exact arrangement you received.
        </p>
      </div>
      <div class="grid">
        ${cards}
      </div>
    `,
  });

  const text = [
    `Spring Blossoms Florist Review Invitation`,
    ``,
    `Hi ${customer.name},`,
    `Your order ${order.orderNumber} has been delivered. We'd love your feedback.`,
    ``,
    ...products.map(
      (product) => `- ${product.title}: ${product.reviewUrl || buildReviewPublicUrl(product, order._id)}`
    ),
  ].join("\n");

  return sendMail({
    to: customer.email,
    cc: "2006sbf@gmail.com",
    subject: `Share your review for order #${order.orderNumber} | Spring Blossoms Florist`,
    html,
    text,
  });
};

const sendReviewReplyNotification = async ({ customer, product, review, replyMessage }) => {
  const reviewUrl = buildReviewPublicUrl(product, review.orderId);
  const html = floralShell({
    preheader: `Spring Blossoms Florist replied to your review`,
    eyebrow: "Review Reply",
    heading: `We replied to your review for ${product.title}`,
    body: "Our team has responded to your feedback. You can continue the conversation on the dedicated review page if you'd like to add anything else.",
    ctaHtml: `
      <div class="section">
        <div class="product">
          <p class="product-name">${product.title}</p>
          <p class="meta" style="margin-bottom:16px;">Order ID: <strong>${review.orderId}</strong></p>
          <p class="meta" style="font-size:15px; color:#4e3a37; background:#fff; padding:16px; border-radius:18px; border:1px solid rgba(138, 75, 63, 0.08);">
            "${replyMessage}"
          </p>
        </div>
      </div>
      <div class="section">
        <a class="cta" href="${reviewUrl}" target="_blank" rel="noopener noreferrer">View Review Thread</a>
      </div>
    `,
  });

  const text = [
    `Spring Blossoms Florist replied to your review`,
    ``,
    `Product: ${product.title}`,
    `Order ID: ${review.orderId}`,
    `Reply: ${replyMessage}`,
    `Review Thread: ${reviewUrl}`,
  ].join("\n");

  return sendMail({
    to: customer.email,
    cc: "2006sbf@gmail.com",
    subject: `We replied to your review for ${product.title}`,
    html,
    text,
  });
};

module.exports = {
  REVIEW_EMAIL_USER,
  buildReviewPublicUrl,
  initReviewEmailTransporter,
  sendReviewReplyNotification,
  sendReviewRequestEmail,
};
