const prisma = require('../config/prisma');

async function fixOrders() {
  console.log('🔄 Checking for orders with paymentMethod = "cod"...');

  const codOrders = await prisma.order.findMany({
    where: {
      OR: [
        { paymentMethod: 'cod' },
        { paymentMethod: 'COD' },
        { paymentMethod: 'cash' },
        { paymentMethod: null }
      ]
    },
    select: {
      id: true,
      orderNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentDetails: true
    }
  });

  console.log(`Found ${codOrders.length} orders with COD/null payment method:`, codOrders);

  for (const o of codOrders) {
    let currentDetails = o.paymentDetails;
    if (typeof currentDetails === 'string') {
      try {
        currentDetails = JSON.parse(currentDetails);
      } catch (e) {
        currentDetails = {};
      }
    }
    const updatedDetails = {
      ...(currentDetails || {}),
      method: 'razorpay',
      status: 'completed'
    };

    const res = await prisma.order.update({
      where: { id: o.id },
      data: {
        paymentMethod: 'razorpay',
        paymentStatus: 'completed',
        paymentDetails: updatedDetails
      }
    });

    console.log(`✅ Order #${res.orderNumber} updated to razorpay / completed`);
  }

  // Also check if any order has paymentDetails JSON containing "cod" even if paymentMethod column isn't cod
  const allOrders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentDetails: true
    }
  });

  for (const o of allOrders) {
    let details = o.paymentDetails;
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) {}
    }
    if (details && typeof details === 'object' && (details.method === 'cod' || details.method === 'COD' || details.method === 'cash')) {
      await prisma.order.update({
        where: { id: o.id },
        data: {
          paymentMethod: 'razorpay',
          paymentStatus: 'completed',
          paymentDetails: {
            ...details,
            method: 'razorpay',
            status: 'completed'
          }
        }
      });
      console.log(`✅ Order #${o.orderNumber} paymentDetails JSON sanitized to razorpay / completed`);
    }
  }

  console.log('\n🎉 Order payment backfill completed!');
}

fixOrders()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('❌ Error fixing orders:', err);
    prisma.$disconnect();
    process.exit(1);
  });
