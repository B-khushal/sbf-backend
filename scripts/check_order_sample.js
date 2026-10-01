const prisma = require('../config/prisma');

async function check() {
  try {
    const count = await prisma.order.count();
    const sample = await prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        orderStatus: true,
        paymentStatus: true,
        paymentMethod: true,
        deliveryDate: true,
        deliverySlot: true,
        totalAmount: true,
        createdAt: true,
        shippingDetails: true,
        giftDetails: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            quantity: true,
            price: true,
            image: true,
            addons: true
          }
        }
      }
    });
    console.log(`Total orders in DB: ${count}`);
    console.log('Sample orders:', JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
