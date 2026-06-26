const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DeliveryPartner = require('../models/DeliveryPartner');
const { protect, admin } = require('../middleware/authMiddleware');
const deliveryController = require('../controllers/deliveryController');

// Helper middleware for Driver authentication
const protectDriver = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.partner = await DeliveryPartner.findById(decoded.id).select('-password');

      if (!req.partner) {
        return res.status(401).json({ message: 'Not authorized, driver profile not found' });
      }

      next();
    } catch (error) {
      console.error('Driver Auth Error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// --- DRIVER AUTH ---
router.post('/auth/register', deliveryController.registerPartner);
router.post('/auth/login', deliveryController.loginPartner);

// --- DRIVER ACTIONS (PROTECTED) ---
router.put('/partner/status', protectDriver, deliveryController.updatePartnerStatus);
router.post('/partner/location', protectDriver, deliveryController.updatePartnerLocation);
router.get('/partner/orders', protectDriver, deliveryController.getPartnerOrders);
router.post('/partner/orders/:assignmentId/accept', protectDriver, deliveryController.acceptOrder);
router.put('/partner/orders/:assignmentId/state', protectDriver, deliveryController.updateOrderDeliveryState);
router.post('/partner/orders/:assignmentId/verify-otp', protectDriver, deliveryController.verifyCustomerOtp);
router.post('/partner/orders/:assignmentId/proof', protectDriver, deliveryController.uploadDeliveryProof);

// --- ADMIN CONTROLS (PROTECTED + ADMIN ROLE) ---
router.get('/admin/partners', protect, admin, deliveryController.getAdminDeliveryPartners);
router.get('/admin/partners/:partnerId', protect, admin, deliveryController.getAdminDeliveryPartnerDetails);
router.get('/admin/active', protect, admin, deliveryController.getAdminActiveDeliveries);
router.get('/admin/analytics', protect, admin, deliveryController.getDeliveryAnalytics);

// Admin settings & overrides
router.get('/admin/settings', protect, admin, deliveryController.getAdminDeliverySettings);
router.put('/admin/settings', protect, admin, deliveryController.updateAdminDeliverySettings);
router.post('/admin/assign', protect, admin, deliveryController.manuallyAssignOrder);
router.post('/admin/orders/:assignmentId/force-complete', protect, admin, deliveryController.forceCompleteAssignment);

// Admin zone management
router.get('/admin/zones', protect, admin, deliveryController.getAdminDeliveryZones);
router.post('/admin/zones', protect, admin, deliveryController.createAdminDeliveryZone);
router.put('/admin/zones/:zoneId', protect, admin, deliveryController.updateAdminDeliveryZone);
router.delete('/admin/zones/:zoneId', protect, admin, deliveryController.deleteAdminDeliveryZone);

// --- CUSTOMER TRACKING (PUBLIC) ---
router.get('/track/:orderNumber', deliveryController.getCustomerTrackingDetails);

module.exports = router;
