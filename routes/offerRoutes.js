const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

// Debug logging
console.log('Loading offerRoutes.js');

const {
  getActiveOffers,
  getAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
  trackOfferImpression,
  trackOfferClose
} = require('../controllers/offerController');

// Debug logging for controller functions
console.log('Controller functions loaded:', {
  getActiveOffers: typeof getActiveOffers,
  getAllOffers: typeof getAllOffers,
  createOffer: typeof createOffer,
  updateOffer: typeof updateOffer,
  deleteOffer: typeof deleteOffer,
  toggleOfferStatus: typeof toggleOfferStatus
});

// Public routes
router.get('/active', getActiveOffers);

// Tracking routes (public)
router.post('/:id/impression', trackOfferImpression);
router.post('/:id/close', trackOfferClose);

// Admin routes (protected)
router.get('/all', protect, admin, getAllOffers);
router.post('/', protect, admin, createOffer);
router.put('/:id', protect, admin, updateOffer);
router.delete('/:id', protect, admin, deleteOffer);
router.patch('/:id/toggle', protect, admin, toggleOfferStatus);

module.exports = router; 