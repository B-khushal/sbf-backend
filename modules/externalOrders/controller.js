const asyncHandler = require('express-async-handler');
const Order = require('../../models/Order');
const User = require('../../models/User');
const { sendDeliveryConfirmationWithInvoice } = require('../../services/emailNotificationService');
const {
  getExternalOrderById,
  getExternalOrdersHealth,
  listExternalOrders,
  updateExternalOrderStatus,
} = require('./service');

const sendEnvelope = (res, { data, message, meta, statusCode = 200 }) => {
  const payload = {
    success: true,
    data,
    message,
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const getHealth = asyncHandler(async (req, res) => {
  return sendEnvelope(res, {
    data: getExternalOrdersHealth(),
    message: 'External orders service is healthy',
  });
});

const listOrders = asyncHandler(async (req, res) => {
  const result = await listExternalOrders(req.externalOrderQuery);

  return sendEnvelope(res, {
    data: result.data,
    message: 'Orders fetched successfully',
    meta: result.meta,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await getExternalOrderById(req.externalOrderId);

  return sendEnvelope(res, {
    data: order,
    message: 'Order fetched successfully',
  });
});

const sendDeliveredEmailIfApplicable = async ({ orderId, changed, nextStatus }) => {
  console.log(`[External Orders] 🔄 sendDeliveredEmailIfApplicable check: OrderID=${orderId}, Changed=${changed}, NextStatus="${nextStatus}"`);
  if (!changed || nextStatus !== 'DELIVERED') {
    return;
  }

  console.log(`[External Orders] 🚚 External order status updated to DELIVERED. Initializing delivery confirmation email flow for OrderID=${orderId}...`);
  try {
    const populatedOrder = await Order.findById(orderId)
      .populate({
        path: 'items.product',
        select: 'name title price images sku discount',
      })
      .exec();

    if (!populatedOrder) {
      console.warn(`[External Orders] ⚠️ Skipped delivery email: order not found (${orderId})`);
      return;
    }

    let customerEmail = '';
    let customerName = populatedOrder.shippingDetails?.fullName || 'Customer';
    let customerPhone = populatedOrder.shippingDetails?.phone || '';

    if (populatedOrder.user) {
      const user = await User.findById(populatedOrder.user).select('name email phone').lean();
      if (user) {
        customerEmail = user.email || customerEmail;
        customerName = user.name || customerName;
        customerPhone = user.phone || customerPhone;
      }
    }

    if (!customerEmail) {
      customerEmail = populatedOrder.shippingDetails?.email || '';
    }

    if (!customerEmail) {
      console.warn(`[External Orders] ⚠️ Skipped delivery email: no customer email (${orderId})`);
      return;
    }

    console.log(`[External Orders] 👤 Resolved customer: Name="${customerName}", Email="${customerEmail}"`);
    console.log(`[External Orders] 📤 Triggering sendDeliveryConfirmationWithInvoice for external order #${populatedOrder.orderNumber}`);

    const emailResult = await sendDeliveryConfirmationWithInvoice({
      order: populatedOrder,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      items: populatedOrder.items,
    });

    console.log(`[External Orders] 📧 sendDeliveryConfirmationWithInvoice output for external order #${populatedOrder.orderNumber}:`, emailResult);

    if (!emailResult?.success) {
      console.error(`[External Orders] ❌ Delivery email failed for ${orderId}:`, emailResult?.error || 'Unknown error');
    } else {
      console.log(`[External Orders] ✅ Delivery email sent successfully for ${orderId}`);
    }
  } catch (error) {
    console.error(`[External Orders] ❌ Delivery email exception for ${orderId}:`, error.message);
    if (error.stack) {
      console.error(`[External Orders] Error stack:`, error.stack);
    }
  }
};

const changeOrderStatus = asyncHandler(async (req, res) => {
  const result = await updateExternalOrderStatus(req.externalOrderId, req.externalOrderStatus);

  await sendDeliveredEmailIfApplicable({
    orderId: req.externalOrderId,
    changed: result.changed,
    nextStatus: result.nextStatus,
  });

  return sendEnvelope(res, {
    data: result.order,
    message: result.changed ? 'Order status updated successfully' : 'Order status unchanged',
  });
});

module.exports = {
  changeOrderStatus,
  getHealth,
  getOrderById,
  listOrders,
  sendEnvelope,
};