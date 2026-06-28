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

  // 2. Email checks (contains example.com, test.com, demo.com)
  const emailLower = email.toLowerCase();
  if (
    emailLower.includes('@example.com') ||
    emailLower.includes('@test.com') ||
    emailLower.includes('@demo.com') ||
    emailLower.startsWith('rahul.sharma@') // rahul.sharma@example.com fallback
  ) {
    return { 
      isPlaceholder: true, 
      reason: 'Placeholder customer email detected.', 
      email, 
      order: actualOrder 
    };
  }

  // 3. Phone checks (9876543210, 9999999999, 1234567890, 0000000000)
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const placeholderPhones = ['9876543210', '9999999999', '1234567890', '0000000000'];
  if (placeholderPhones.includes(cleanPhone)) {
    return { 
      isPlaceholder: true, 
      reason: 'Placeholder customer phone detected.', 
      email, 
      order: actualOrder 
    };
  }

  // 4. Keyword checks (test, demo, sample, placeholder, dummy, qa, internal, developer)
  const keywords = ['test', 'demo', 'sample', 'placeholder', 'dummy', 'qa', 'internal', 'developer'];
  const fieldsToCheck = [fullName, address, notes, message, emailLower];

  for (const field of fieldsToCheck) {
    if (field && typeof field === 'string') {
      const fieldLower = field.toLowerCase();
      for (const keyword of keywords) {
        if (fieldLower.includes(keyword)) {
          return { 
            isPlaceholder: true, 
            reason: `Keyword '${keyword}' found in customer fields.`, 
            email, 
            order: actualOrder 
          };
        }
      }
    }
  }

  return { isPlaceholder: false };
};

module.exports = {
  checkIsPlaceholderCustomer
};
