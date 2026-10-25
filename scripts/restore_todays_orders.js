const prisma = require('../config/prisma');

async function restoreTodaysOrders() {
  console.log('--- Restoring Today\'s Orders (25 Oct 2026) ---');

  // 1. Create or Update Khushal Prasad's Combo Order (#261000225)
  const khushalOrderId = 'ord_1792925533769_kpcombo';
  
  // Clean up any items that might reference this ID first
  await prisma.orderItem.deleteMany({
    where: { orderId: khushalOrderId }
  });

  const khushalOrder = await prisma.order.upsert({
    where: { id: khushalOrderId },
    update: {
      orderNumber: '261000225',
      userId: '6a24223766953fdb14ab7559',
      customerName: 'khushal prasad',
      customerEmail: 'khushalprasad242@gmail.com',
      customerPhone: '9959109048',
      totalAmount: 26.99,
      subtotal: 2699.00,
      taxAmount: 0,
      shippingFee: 0,
      discountAmount: 2672.01,
      orderStatus: 'order_placed',
      paymentStatus: 'completed',
      paymentMethod: 'razorpay',
      razorpayOrderId: 'order_Ts7AV32pr31fSI',
      razorpayPaymentId: 'pay_Ts7Ag1N2wiDemu',
      deliveryDate: new Date('2026-10-24T18:30:00.000Z'),
      deliverySlot: 'same_day',
      cardMessage: 'happy birthday',
      deliveryCharge: 0,
      discount: 2672.01,
      finalTotal: 26.99,
      currency: 'INR',
      currencyRate: 1,
      stockUpdated: false,
      isTestOrder: false,
      createdAt: new Date('2026-10-25T10:52:13.000Z'),
      updatedAt: new Date('2026-10-25T10:52:41.000Z'),
      shippingAddress: {
        city: 'Hyderabad',
        email: 'khushalprasad242@gmail.com',
        floor: '',
        phone: '9959109048',
        state: 'Telangana',
        address: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        houseNo: '',
        zipCode: '500028',
        fullName: 'khushal prasad',
        landmark: '',
        lastName: 'prasad',
        latitude: 17.3912,
        timeSlot: 'same_day',
        apartment: '',
        firstName: 'khushal',
        longitude: 78.4326,
        cardMessage: 'happy birthday',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        deliverySpecialInstructions: 'leave at door'
      },
      shippingDetails: {
        city: 'Hyderabad',
        email: 'khushalprasad242@gmail.com',
        floor: '',
        phone: '9959109048',
        state: 'Telangana',
        address: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        houseNo: '',
        zipCode: '500028',
        fullName: 'khushal prasad',
        landmark: '',
        lastName: 'prasad',
        latitude: 17.3912,
        timeSlot: 'same_day',
        apartment: '',
        firstName: 'khushal',
        longitude: 78.4326,
        cardMessage: 'happy birthday',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        deliverySpecialInstructions: 'leave at door'
      },
      paymentDetails: {
        method: 'razorpay',
        status: 'completed',
        razorpayOrderId: 'order_Ts7AV32pr31fSI',
        razorpayPaymentId: 'pay_Ts7Ag1N2wiDemu'
      },
      giftDetails: {
        floor: '',
        country: 'India',
        houseNo: '',
        message: 'happy birthday',
        pincode: '500028',
        landmark: '',
        latitude: 17.3912,
        longitude: 78.4326,
        greetingCard: 'none',
        anonymousGift: false,
        recipientCity: 'Hyderabad',
        recipientName: '',
        recipientEmail: '',
        recipientPhone: '',
        recipientState: 'Telangana',
        formattedAddress: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        recipientAddress: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        recipientZipCode: '500028',
        surpriseDelivery: false,
        recipientApartment: '',
        deliveryInstructions: 'leave at door'
      }
    },
    create: {
      id: khushalOrderId,
      orderNumber: '261000225',
      userId: '6a24223766953fdb14ab7559',
      customerName: 'khushal prasad',
      customerEmail: 'khushalprasad242@gmail.com',
      customerPhone: '9959109048',
      totalAmount: 26.99,
      subtotal: 2699.00,
      taxAmount: 0,
      shippingFee: 0,
      discountAmount: 2672.01,
      orderStatus: 'order_placed',
      paymentStatus: 'completed',
      paymentMethod: 'razorpay',
      razorpayOrderId: 'order_Ts7AV32pr31fSI',
      razorpayPaymentId: 'pay_Ts7Ag1N2wiDemu',
      deliveryDate: new Date('2026-10-24T18:30:00.000Z'),
      deliverySlot: 'same_day',
      cardMessage: 'happy birthday',
      deliveryCharge: 0,
      discount: 2672.01,
      finalTotal: 26.99,
      currency: 'INR',
      currencyRate: 1,
      stockUpdated: false,
      isTestOrder: false,
      createdAt: new Date('2026-10-25T10:52:13.000Z'),
      updatedAt: new Date('2026-10-25T10:52:41.000Z'),
      shippingAddress: {
        city: 'Hyderabad',
        email: 'khushalprasad242@gmail.com',
        floor: '',
        phone: '9959109048',
        state: 'Telangana',
        address: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        houseNo: '',
        zipCode: '500028',
        fullName: 'khushal prasad',
        landmark: '',
        lastName: 'prasad',
        latitude: 17.3912,
        timeSlot: 'same_day',
        apartment: '',
        firstName: 'khushal',
        longitude: 78.4326,
        cardMessage: 'happy birthday',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        deliverySpecialInstructions: 'leave at door'
      },
      shippingDetails: {
        city: 'Hyderabad',
        email: 'khushalprasad242@gmail.com',
        floor: '',
        phone: '9959109048',
        state: 'Telangana',
        address: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        houseNo: '',
        zipCode: '500028',
        fullName: 'khushal prasad',
        landmark: '',
        lastName: 'prasad',
        latitude: 17.3912,
        timeSlot: 'same_day',
        apartment: '',
        firstName: 'khushal',
        longitude: 78.4326,
        cardMessage: 'happy birthday',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        deliverySpecialInstructions: 'leave at door'
      },
      paymentDetails: {
        method: 'razorpay',
        status: 'completed',
        razorpayOrderId: 'order_Ts7AV32pr31fSI',
        razorpayPaymentId: 'pay_Ts7Ag1N2wiDemu'
      },
      giftDetails: {
        floor: '',
        country: 'India',
        houseNo: '',
        message: 'happy birthday',
        pincode: '500028',
        landmark: '',
        latitude: 17.3912,
        longitude: 78.4326,
        greetingCard: 'none',
        anonymousGift: false,
        recipientCity: 'Hyderabad',
        recipientName: '',
        recipientEmail: '',
        recipientPhone: '',
        recipientState: 'Telangana',
        formattedAddress: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        recipientAddress: ' Pillar Number 32, Najam Centre, A/B, Door No. 12-2, 786, Rethi Bowli Rd, Mehdipatnam',
        recipientZipCode: '500028',
        surpriseDelivery: false,
        recipientApartment: '',
        deliveryInstructions: 'leave at door'
      }
    }
  });

  await prisma.orderItem.create({
    data: {
      id: 'item_1792925533769_kpcombo',
      orderId: khushalOrderId,
      productId: 'prod_1791718476503_gmi1w',
      productName: 'Scarlet & Blush Rose Romance with chocolate cake',
      variantName: '0.5 Kg • Eggless',
      price: 2699.00,
      quantity: 1,
      subtotal: 2699.00,
      image: 'https://res.cloudinary.com/djtrhfqan/image/upload/v1791718461/sbf-products/image-1791718453594-683913942.jpg',
      addons: {
        addons: [],
        weight: '0.5 Kg',
        addonId: 'prod_1791718476503_gmi1w',
        eggless: true,
        isAddon: false,
        isCombo: true,
        addonTotal: 0,
        cakeServes: '4–6 People',
        cakeWeight: '0.5 Kg',
        isGiftBundle: true,
        productModel: 'Product',
        giftComponents: [
          { name: 'Scarlet & Blush Rose Romance', category: 'Bouquet' },
          { name: 'chocolate cake', category: 'Cake (0.5 Kg)' }
        ]
      }
    }
  });
  console.log('✅ Khushal Prasad Order #261000225 successfully saved.');

  // 2. Restore Sushmitha Ragi's Order (#261000125) on ord_1792899028291_mjurv
  const sushmithaOrderId = 'ord_1792899028291_mjurv';

  // Clean existing items on sushmithaOrderId (which had been overwritten by combo item)
  await prisma.orderItem.deleteMany({
    where: { orderId: sushmithaOrderId }
  });

  const sushmithaOrder = await prisma.order.update({
    where: { id: sushmithaOrderId },
    data: {
      orderNumber: '261000125',
      userId: 'usr_1792898726545_ii0xs',
      customerName: 'Sushmitha Ragi',
      customerEmail: 'sushmitha.b10@gmail.com',
      customerPhone: '9963111686',
      totalAmount: 799.00,
      subtotal: 799.00,
      taxAmount: 0,
      shippingFee: 0,
      discountAmount: 0,
      orderStatus: 'preparing',
      paymentStatus: 'completed',
      paymentMethod: 'razorpay',
      razorpayOrderId: 'order_TrzdGyO0gsGQoi',
      razorpayPaymentId: 'pay_TrzdP57DgpeECt',
      deliveryDate: new Date('2026-10-24T18:30:00.000Z'),
      deliverySlot: 'same_day',
      cardMessage: null,
      deliveryCharge: 0,
      discount: 0,
      finalTotal: 799.00,
      currency: 'INR',
      currencyRate: 1,
      stockUpdated: true,
      isTestOrder: false,
      createdAt: new Date('2026-10-25T03:30:28.293Z'),
      updatedAt: new Date('2026-10-25T10:39:39.642Z'),
      shippingAddress: {
        city: 'Hyderabad',
        email: 'sushmitha.b10@gmail.com',
        phone: '9963111686',
        state: 'Telangana',
        address: 'Hyderabad, Telangana',
        apartment: '',
        zipCode: '500001',
        fullName: 'Sushmitha Ragi',
        firstName: 'Sushmitha',
        lastName: 'Ragi',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        timeSlot: 'same_day'
      },
      shippingDetails: {
        city: 'Hyderabad',
        email: 'sushmitha.b10@gmail.com',
        phone: '9963111686',
        state: 'Telangana',
        address: 'Hyderabad, Telangana',
        apartment: '',
        zipCode: '500001',
        fullName: 'Sushmitha Ragi',
        firstName: 'Sushmitha',
        lastName: 'Ragi',
        deliveryDate: '2026-10-24T18:30:00.000Z',
        timeSlot: 'same_day'
      },
      paymentDetails: {
        method: 'razorpay',
        status: 'completed',
        razorpayOrderId: 'order_TrzdGyO0gsGQoi',
        razorpayPaymentId: 'pay_TrzdP57DgpeECt'
      },
      giftDetails: null
    }
  });

  await prisma.orderItem.create({
    data: {
      id: 'item_1792899028293_sush',
      orderId: sushmithaOrderId,
      productId: '6a35287e121d1f89ed382e17',
      productName: 'Pink Roses & Orchid Elegance Bouquet',
      variantName: null,
      price: 799.00,
      quantity: 1,
      subtotal: 799.00,
      image: 'https://res.cloudinary.com/djtrhfqan/image/upload/v1781883458/sbf-products/migrated-6a35287e121d1f89ed382e17-0-1781883456496.jpg',
      addons: null
    }
  });
  console.log('✅ Sushmitha Ragi Order #261000125 successfully restored.');

  // 3. Update notification #261000125 for combo order to #261000225
  await prisma.notification.updateMany({
    where: {
      id: 'notif_1792925561070_swbu1'
    },
    data: {
      message: 'Order #261000225 placed by SBF Admin. Amount: ₹26.99 • 🎁 Duo Combo (0.5 Kg Cake)'
    }
  });
  console.log('✅ Notifications updated.');

  console.log('--- Restoration Complete ---');
}

restoreTodaysOrders()
  .catch(err => {
    console.error('❌ Error restoring orders:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
