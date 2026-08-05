const fs = require('fs');
const prisma = require('./config/prisma');

async function main() {
  const orders = JSON.parse(fs.readFileSync('D:/SBF/mongodb_backup/test/orders.json', 'utf8'));
  console.log(`Starting sync for ${orders.length} orders...`);

  for (const o of orders) {
    const ship = o.shippingDetails || {};
    const gift = o.giftDetails || {};
    const pay = o.paymentDetails || {};

    const shipAddrObj = {
      fullName: ship.fullName || 'Customer',
      email: ship.email || '',
      phone: ship.phone || '',
      address: ship.address || gift.formattedAddress || '',
      city: ship.city || gift.recipientCity || 'Hyderabad',
      state: ship.state || gift.recipientState || 'Telangana',
      zipCode: ship.zipCode || gift.pincode || '500028',
      houseNo: gift.houseNo || '',
      landmark: gift.landmark || ''
    };

    // Ensure user exists if referenced
    let validUserId = null;
    if (o.user && typeof o.user === 'string') {
      const u = await prisma.user.findUnique({ where: { id: o.user } });
      if (u) validUserId = u.id;
    }

    await prisma.order.upsert({
      where: { id: o._id },
      update: {
        orderNumber: o.orderNumber,
        userId: validUserId,
        customerName: ship.fullName || null,
        customerEmail: ship.email || null,
        customerPhone: ship.phone || null,
        totalAmount: o.totalAmount ? parseFloat(o.totalAmount) : 0,
        subtotal: o.subtotal ? parseFloat(o.subtotal) : 0,
        shippingFee: o.deliveryCharge ? parseFloat(o.deliveryCharge) : 0,
        discountAmount: o.discount ? parseFloat(o.discount) : 0,
        orderStatus: o.status || 'order_placed',
        paymentStatus: pay.razorpayPaymentId ? 'completed' : 'pending',
        paymentMethod: pay.method || 'razorpay',
        razorpayOrderId: pay.razorpayOrderId || null,
        razorpayPaymentId: pay.razorpayPaymentId || null,
        razorpaySignature: pay.razorpaySignature || null,
        shippingAddress: shipAddrObj,
        deliveryDate: ship.deliveryDate ? new Date(ship.deliveryDate) : null,
        deliverySlot: ship.timeSlot || null,
        cardMessage: gift.message || null
      },
      create: {
        id: o._id,
        orderNumber: o.orderNumber || `SBF-${Date.now()}`,
        userId: validUserId,
        customerName: ship.fullName || null,
        customerEmail: ship.email || null,
        customerPhone: ship.phone || null,
        totalAmount: o.totalAmount ? parseFloat(o.totalAmount) : 0,
        subtotal: o.subtotal ? parseFloat(o.subtotal) : 0,
        shippingFee: o.deliveryCharge ? parseFloat(o.deliveryCharge) : 0,
        discountAmount: o.discount ? parseFloat(o.discount) : 0,
        orderStatus: o.status || 'order_placed',
        paymentStatus: pay.razorpayPaymentId ? 'completed' : 'pending',
        paymentMethod: pay.method || 'razorpay',
        razorpayOrderId: pay.razorpayOrderId || null,
        razorpayPaymentId: pay.razorpayPaymentId || null,
        razorpaySignature: pay.razorpaySignature || null,
        shippingAddress: shipAddrObj,
        deliveryDate: ship.deliveryDate ? new Date(ship.deliveryDate) : null,
        deliverySlot: ship.timeSlot || null,
        cardMessage: gift.message || null
      }
    });

    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        let validProductId = null;
        if (item.product && typeof item.product === 'string') {
          const p = await prisma.product.findUnique({ where: { id: item.product } });
          if (p) validProductId = p.id;
        }

        await prisma.orderItem.upsert({
          where: { id: item._id },
          update: {
            productId: validProductId,
            productName: item.title || 'Product Item',
            price: item.price ? parseFloat(item.price) : 0,
            quantity: item.quantity || 1,
            subtotal: item.finalPrice ? parseFloat(item.finalPrice) : (item.price ? parseFloat(item.price) : 0),
            image: item.image || (item.images && item.images[0]) || null
          },
          create: {
            id: item._id,
            orderId: o._id,
            productId: validProductId,
            productName: item.title || 'Product Item',
            price: item.price ? parseFloat(item.price) : 0,
            quantity: item.quantity || 1,
            subtotal: item.finalPrice ? parseFloat(item.finalPrice) : (item.price ? parseFloat(item.price) : 0),
            image: item.image || (item.images && item.images[0]) || null
          }
        });
      }
    }

    if (Array.isArray(o.trackingHistory)) {
      for (const tr of o.trackingHistory) {
        const trId = tr._id || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const trExists = await prisma.orderTimeline.findUnique({ where: { id: trId } });
        if (!trExists) {
          await prisma.orderTimeline.create({
            data: {
              id: trId,
              orderId: o._id,
              status: tr.status || 'order_placed',
              title: tr.status ? tr.status.replace(/_/g, ' ') : 'Order Placed',
              description: tr.message || 'Order status updated',
              timestamp: tr.timestamp ? new Date(tr.timestamp) : new Date()
            }
          });
        }
      }
    }
  }

  console.log('✅ ALL ORDERS SYNCED SUCCESSFULLY FROM BACKUP JSON TO POSTGRESQL!');
}

main().catch(console.error);
