/**
 * Utility to identify test or placeholder customer details.
 * Used to suppress customer-facing communications (emails, SMS, WhatsApp, review requests)
 * for testing and staging order flows, preventing bounce messages and logs pollution.
 */
const checkIsPlaceholderCustomer = (order) => {
  if (!order) return { isPlaceholder: false };

  // Support both nested structure and flat structure
  const actualOrder = order.order || order.orderData || order;

  // 1. Check isTestOrder flag explicitly
  if (actualOrder.isTestOrder === true) {
    return { isPlaceholder: true, reason: 'isTestOrder flag set to true', order: actualOrder };
  }

  // Extract shippingDetails, giftDetails, and customer fields
  const shippingDetails = actualOrder.shippingDetails || {};
  const giftDetails = actualOrder.giftDetails || {};
  const customer = actualOrder.customer || {};

  const email = shippingDetails.email || giftDetails.recipientEmail || customer.email || '';
  const phone = shippingDetails.phone || giftDetails.recipientPhone || customer.phone || '';
  const fullName = shippingDetails.fullName || giftDetails.recipientName || customer.name || '';
  const address = shippingDetails.address || giftDetails.recipientAddress || '';
  const notes = shippingDetails.notes || '';
  const message = giftDetails.message || '';

  // 2. Email domain checks for explicit test domains
  const emailLower = email.toLowerCase();
  if (
    emailLower.endsWith('@example.com') ||
    emailLower.endsWith('@test.com') ||
    emailLower.endsWith('@demo.com') ||
    emailLower.endsWith('@localhost') ||
    emailLower === 'placeholder@sbflorist.in' ||
    emailLower === 'dummy@sbflorist.in'
  ) {
    return { 
      isPlaceholder: true, 
      reason: 'Placeholder customer email domain detected.', 
      email, 
      order: actualOrder 
    };
  }

  return { isPlaceholder: false };
};

module.exports = {
  checkIsPlaceholderCustomer
};
