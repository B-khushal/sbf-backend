require('dotenv').config();
const Order = require('../models/Order');
const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');

async function test() {
  const order = await Order.findOne({ status: 'delivered' });
  if (!order) {
    console.log('No delivered order found, finding any order...');
    const anyOrder = await Order.findOne();
    console.log('Found order:', anyOrder?.orderNumber);
    return testWithOrder(anyOrder);
  }
  console.log('Found delivered order:', order.orderNumber);
  return testWithOrder(order);
}

async function testWithOrder(order) {
  const populatedOrder = await Order.findById(order._id).populate({
    path: 'items.product',
    select: 'name title price images sku discount'
  });

  const deliveryData = {
    order: populatedOrder,
    customer: {
      name: order.shippingDetails?.fullName || 'Test Customer',
      email: '2006sbf@gmail.com', // test with verified email so we don't spam customer
      phone: order.shippingDetails?.phone || '9999999999'
    },
    items: populatedOrder.items
  };

  console.log('Testing sendDeliveryConfirmationWithInvoice with order:', order.orderNumber);
  const result = await sendDeliveryConfirmationWithInvoice(deliveryData);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error).finally(() => process.exit());
