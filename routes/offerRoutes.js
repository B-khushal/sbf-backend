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
  toggleOfferStatus
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

// Offer tracking routes (public)
router.post('/:id/impression', async (req, res) => {
  try {
    console.log('Offer impression tracked:', req.params.id);
    res.json({ success: true, message: 'Impression tracked' });
  } catch (error) {
    console.error('Error tracking impression:', error);
    res.status(500).json({ success: false, message: 'Failed to track impression' });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    console.log('Offer close tracked:', req.params.id);
    res.json({ success: true, message: 'Close tracked' });
  } catch (error) {
    console.error('Error tracking close:', error);
    res.status(500).json({ success: false, message: 'Failed to track close' });
  }
});

// Admin routes (protected)
router.get('/all', protect, admin, getAllOffers);
router.post('/', protect, admin, createOffer);
router.put('/:id', protect, admin, updateOffer);
router.delete('/:id', protect, admin, deleteOffer);
router.patch('/:id/toggle', protect, admin, toggleOfferStatus);

module.exports = router; 