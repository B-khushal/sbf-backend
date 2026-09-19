const prisma = require('../config/prisma');

async function check() {
  const orders = await prisma.order.findMany({
    select: {
      orderNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      razorpayPaymentId: true,
      paymentDetails: true
    }
  });
  console.log('Total orders:', orders.length);
  console.log(orders);
}

check()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
