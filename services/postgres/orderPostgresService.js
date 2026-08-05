const prisma = require('../../config/prisma');

class OrderPostgresService {
  async createOrderWithTransaction(orderData) {
    return await prisma.$transaction(async (tx) => {
      // 1. Generate Order Number
      const orderCount = await tx.order.count();
      const orderNumber = `SBF-${Date.now().toString().slice(-6)}-${(orderCount + 1).toString().padStart(4, '0')}`;
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // 2. Create Order Record
      const order = await tx.order.create({
        data: {
          id: orderId,
          orderNumber,
          userId: orderData.userId || null,
          customerName: orderData.customerName,
          customerEmail: orderData.customerEmail,
          customerPhone: orderData.customerPhone,
          totalAmount: orderData.totalAmount,
          subtotal: orderData.subtotal,
          taxAmount: orderData.taxAmount || 0,
          shippingFee: orderData.shippingFee || 0,
          discountAmount: orderData.discountAmount || 0,
          orderStatus: 'pending',
          paymentStatus: orderData.paymentStatus || 'pending',
          paymentMethod: orderData.paymentMethod || 'razorpay',
          razorpayOrderId: orderData.razorpayOrderId || null,
          shippingAddress: orderData.shippingAddress || null,
          billingAddress: orderData.billingAddress || null,
          deliveryDate: orderData.deliveryDate ? new Date(orderData.deliveryDate) : null,
          deliverySlot: orderData.deliverySlot || null,
          cardMessage: orderData.cardMessage || null,
          recipientName: orderData.recipientName || null,
          recipientPhone: orderData.recipientPhone || null,
          promoCode: orderData.promoCode || null,
          items: {
            create: orderData.items.map(item => ({
              id: `ord_item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              productId: item.productId || null,
              productName: item.productName || item.name,
              variantName: item.variantName || item.size || null,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.price * item.quantity,
              image: item.image || null
            }))
          },
          timeline: {
            create: {
              id: `ot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              status: 'pending',
              title: 'Order Placed',
              description: 'Your order has been placed successfully.'
            }
          }
        },
        include: {
          items: true,
          timeline: true
        }
      });

      // 3. Decrement Inventory Stock safely within transaction
      for (const item of orderData.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity }
            }
          }).catch(() => {}); // ignore if product deleted
        }
      }

      // 4. Update PromoCode Usage if applied
      if (orderData.promoCode) {
        await tx.promoCode.update({
          where: { code: orderData.promoCode },
          data: { usedCount: { increment: 1 } }
        }).catch(() => {});
      }

      return order;
    });
  }

  async getOrderById(id) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        timeline: { orderBy: { timestamp: 'asc' } },
        payments: true,
        deliveryAssignment: { include: { deliveryPartner: true } }
      }
    });
  }

  async getOrdersByUser(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          items: true,
          deliveryAssignment: true
        }
      }),
      prisma.order.count({ where: { userId } })
    ]);

    return { orders, total, page: parseInt(page), pages: Math.ceil(total / limit) };
  }
}

module.exports = new OrderPostgresService();
