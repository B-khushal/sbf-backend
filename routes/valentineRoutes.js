const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const valentineController = require('../controllers/valentineController');

// ============================================================
//  PUBLIC ROUTES
// ============================================================
router.get('/status', valentineController.getValentineStatus);
router.get('/settings', valentineController.getValentineSettings);
router.get('/timeline', valentineController.getTimeline);
router.get('/products', valentineController.getAllValentineProducts);
router.get('/products/:dateSlug', valentineController.getProductsByDate);
router.get('/offers', valentineController.getOffers);
router.get('/gift-builder/items', valentineController.getGiftBuilderItems);
router.post('/gift-builder/calculate', valentineController.calculateGiftPrice);

// ============================================================
//  ADMIN ROUTES (Protected)
// ============================================================
router.put('/toggle', protect, admin, valentineController.toggleValentine);
router.put('/settings', protect, admin, valentineController.updateSettings);
router.put('/timeline/:id', protect, admin, valentineController.updateTimelineCard);
router.get('/offers/all', protect, admin, valentineController.getAllOffers);
router.post('/offers', protect, admin, valentineController.createOffer);
router.put('/offers/:id', protect, admin, valentineController.updateOffer);
router.delete('/offers/:id', protect, admin, valentineController.deleteOffer);
router.put('/products/:productId/assign', protect, admin, valentineController.assignProductToDate);
router.get('/analytics', protect, admin, valentineController.getAnalytics);

module.exports = router;
