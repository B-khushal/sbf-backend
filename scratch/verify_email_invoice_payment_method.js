const { generateInvoiceHTML, generateDeliveryConfirmationWithInvoiceEmail } = require('../services/emailNotificationService');

const mockOrder = {
  orderNumber: '260900119',
  createdAt: new Date(),
  totalAmount: 1499,
  subtotal: 1399,
  shippingFee: 100,
  currency: 'INR',
  status: 'delivered',
  paymentMethod: 'razorpay',
  paymentStatus: 'completed',
  paymentDetails: {
    method: 'razorpay',
    status: 'completed',
    razorpayPaymentId: 'pay_test123456'
  },
  shippingDetails: {
    fullName: 'Test Customer',
    phone: '9999999999',
    address: '123 Test Street',
    city: 'Hyderabad',
    state: 'Telangana',
    zipCode: '500028',
    deliveryDate: new Date(),
    timeSlot: 'morning'
  },
  items: [
    {
      title: 'Red Roses Bouquet',
      quantity: 1,
      finalPrice: 1399,
      product: { title: 'Red Roses Bouquet', sku: 'RRB-01' }
    }
  ]
};

const customer = {
  name: 'Test Customer',
  email: 'test@sbflorist.in',
  phone: '9999999999'
};

const invoiceHtml = generateInvoiceHTML({ order: mockOrder, customer });
const deliveryEmailHtml = generateDeliveryConfirmationWithInvoiceEmail({ order: mockOrder, customer, items: mockOrder.items });

console.log('--- Checking Invoice HTML for Payment Method ---');
if (invoiceHtml.includes('Method:</strong> Online Payment (Razorpay)')) {
  console.log('✅ Invoice HTML displays "Online Payment (Razorpay)" perfectly!');
} else {
  console.error('❌ Invoice HTML does not have expected text:');
  const match = invoiceHtml.match(/Method:<\/strong>([^<]+)/);
  console.log('Found:', match ? match[0] : 'None');
}

console.log('\n--- Checking Delivery Confirmation Email for Payment Method ---');
if (deliveryEmailHtml.includes('<strong>Method:</strong> Online Payment (Razorpay)')) {
  console.log('✅ Delivery email displays "Online Payment (Razorpay)" perfectly!');
} else {
  console.error('❌ Delivery email does not have expected text:');
  const match = deliveryEmailHtml.match(/<strong>Method:<\/strong>([^<]+)/);
  console.log('Found:', match ? match[0] : 'None');
}

// Test with legacy/null/cod order object to verify robust fallback
const codMockOrder = {
  ...mockOrder,
  paymentMethod: 'cod',
  paymentDetails: { method: 'cod', status: 'completed' }
};

const fallbackInvoiceHtml = generateInvoiceHTML({ order: codMockOrder, customer });
const fallbackDeliveryEmailHtml = generateDeliveryConfirmationWithInvoiceEmail({ order: codMockOrder, customer, items: codMockOrder.items });

console.log('\n--- Checking Legacy "COD" Order Fallback ---');
if (fallbackInvoiceHtml.includes('Method:</strong> Online Payment (Razorpay)')) {
  console.log('✅ Legacy "cod" order Invoice automatically normalizes to "Online Payment (Razorpay)"!');
} else {
  console.error('❌ Legacy fallback failed in invoice');
}

if (fallbackDeliveryEmailHtml.includes('<strong>Method:</strong> Online Payment (Razorpay)')) {
  console.log('✅ Legacy "cod" order Delivery Email automatically normalizes to "Online Payment (Razorpay)"!');
} else {
  console.error('❌ Legacy fallback failed in delivery email');
}
