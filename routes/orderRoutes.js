const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  createOrder,
  getOrders,
  getUserOrders,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  updateOrderStatus,
  getNextOrderNumber,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getUpcomingDeliveries,
  getDeliveryCalendar,
  testDeliveryEmail,
} = require('../controllers/orderController');

router.post('/', protect, createOrder);
router.get('/', protect, admin, getOrders);
router.get('/myorders', protect, getUserOrders);

// New date and delivery focused routes
router.get('/upcoming-deliveries', protect, admin, getUpcomingDeliveries);
router.get('/delivery-calendar', protect, admin, getDeliveryCalendar);

// Test delivery email route
router.post('/test-delivery-email', protect, admin, testDeliveryEmail);

router.route('/:id')
  .get(protect, getOrderById);

router.route('/:id/pay')
  .put(protect, updateOrderToPaid);

router.route('/:id/deliver')
  .put(protect, admin, updateOrderToDelivered);

router.route('/:id/status')
  .put(protect, admin, updateOrderStatus);

router.post('/next-number', getNextOrderNumber);

// Razorpay specific routes
router.post('/create-razorpay-order', protect, createRazorpayOrder);
router.post('/verify-payment', protect, verifyRazorpayPayment);

module.exports = router;
