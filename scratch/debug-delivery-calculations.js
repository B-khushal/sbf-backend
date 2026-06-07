const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Order = require('../models/Order');
const { checkFirstOrderEligibility, calculateDeliveryFee } = require('../services/deliveryService');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sbf-florist';

async function runTests() {
  console.log('🔌 Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected successfully!');

  // Clean up any existing test orders first
  console.log('🧹 Cleaning up test orders...');
  await Order.deleteMany({ 'shippingDetails.email': /test-delivery-calculations/i });

  const testEmail = 'test-delivery-calculations@example.com';
  const testPhone = '9999999999';
  const testUserId = new mongoose.Types.ObjectId().toString();

  console.log('\n--- Test 1: Initial eligibility (no orders placed yet) ---');
  let eligible = await checkFirstOrderEligibility({ email: testEmail, phone: testPhone });
  console.log(`Email/Phone eligible (should be true): ${eligible}`);
  
  let feeResult = await calculateDeliveryFee({ subtotal: 1000, email: testEmail, phone: testPhone });
  console.log(`Calculated fee: ₹${feeResult.deliveryCharge} (should be ₹0)`);
  console.log(`Is first order free: ${feeResult.isFirstOrderFreeDelivery} (should be true)`);

  console.log('\n--- Test 2: Create a cancelled order and test eligibility ---');
  const cancelledOrder = new Order({
    orderNumber: `TEST${Date.now()}1`,
    subtotal: 1000,
    deliveryCharge: 0,
    discount: 0,
    finalTotal: 1000,
    totalAmount: 1000,
    isFirstOrderFreeDelivery: true,
    status: 'cancelled',
    shippingDetails: {
      fullName: 'Test Calculations User',
      email: testEmail,
      phone: testPhone,
      address: '123 Test Street',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500028',
      deliveryDate: new Date(),
      timeSlot: 'standard'
    },
    paymentDetails: {
      method: 'cash'
    },
    items: []
  });
  await cancelledOrder.save();
  console.log('Cancelled order saved.');

  eligible = await checkFirstOrderEligibility({ email: testEmail, phone: testPhone });
  console.log(`Email/Phone eligible with only cancelled order (should be true): ${eligible}`);
  
  feeResult = await calculateDeliveryFee({ subtotal: 1000, email: testEmail, phone: testPhone });
  console.log(`Calculated fee: ₹${feeResult.deliveryCharge} (should be ₹0)`);

  console.log('\n--- Test 3: Create a successful (placed) order and test eligibility ---');
  const placedOrder = new Order({
    orderNumber: `TEST${Date.now()}2`,
    subtotal: 1000,
    deliveryCharge: 0,
    discount: 0,
    finalTotal: 1000,
    totalAmount: 1000,
    isFirstOrderFreeDelivery: true,
    status: 'order_placed',
    shippingDetails: {
      fullName: 'Test Calculations User',
      email: testEmail,
      phone: testPhone,
      address: '123 Test Street',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500028',
      deliveryDate: new Date(),
      timeSlot: 'standard'
    },
    paymentDetails: {
      method: 'cash'
    },
    items: []
  });
  await placedOrder.save();
  console.log('Successful order saved.');

  eligible = await checkFirstOrderEligibility({ email: testEmail, phone: testPhone });
  console.log(`Email/Phone eligible with successful order (should be false): ${eligible}`);
  
  feeResult = await calculateDeliveryFee({ subtotal: 1000, email: testEmail, phone: testPhone });
  console.log(`Calculated fee (standard): ₹${feeResult.deliveryCharge} (should be ₹150)`);
  console.log(`Is first order free: ${feeResult.isFirstOrderFreeDelivery} (should be false)`);

  console.log('\n--- Test 4: Midnight timeslot calculation for non-eligible user ---');
  feeResult = await calculateDeliveryFee({ subtotal: 1000, timeSlot: 'midnight', email: testEmail, phone: testPhone });
  console.log(`Midnight delivery fee: ₹${feeResult.deliveryCharge} (should be ₹300)`);
  console.log(`Is first order free: ${feeResult.isFirstOrderFreeDelivery} (should be false)`);

  console.log('\n--- Test 5: First order free with User ID matching ---');
  // Use a fresh user ID
  eligible = await checkFirstOrderEligibility({ userId: testUserId });
  console.log(`User ID eligible initially (should be true): ${eligible}`);
  
  // Save an order with that user ID
  const userOrder = new Order({
    orderNumber: `TEST${Date.now()}3`,
    user: testUserId,
    subtotal: 1000,
    deliveryCharge: 0,
    discount: 0,
    finalTotal: 1000,
    totalAmount: 1000,
    isFirstOrderFreeDelivery: true,
    status: 'order_placed',
    shippingDetails: {
      fullName: 'Test Calculations User',
      email: 'another-email@example.com',
      phone: '8888888888',
      address: '123 Test Street',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500028',
      deliveryDate: new Date(),
      timeSlot: 'standard'
    },
    paymentDetails: {
      method: 'cash'
    },
    items: []
  });
  await userOrder.save();
  console.log('User order saved.');
  
  eligible = await checkFirstOrderEligibility({ userId: testUserId });
  console.log(`User ID eligible after order saved (should be false): ${eligible}`);

  // Clean up
  console.log('\n🧹 Cleaning up test orders...');
  await Order.deleteMany({ 'shippingDetails.email': { $in: [testEmail, 'another-email@example.com'] } });
  
  console.log('🎉 Tests completed successfully!');
}

runTests()
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Tests failed:', err);
    mongoose.connection.close();
    process.exit(1);
  });
