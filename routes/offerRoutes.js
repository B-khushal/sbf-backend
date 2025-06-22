const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const {
  getActiveOffers,
  getAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus
} = require('../controllers/offerController');

// Public routes
router.get('/active', getActiveOffers);

// Admin routes
router.get('/all', authMiddleware, isAdmin, getAllOffers);
router.post('/', authMiddleware, isAdmin, createOffer);
router.put('/:id', authMiddleware, isAdmin, updateOffer);
router.delete('/:id', authMiddleware, isAdmin, deleteOffer);
router.patch('/:id/toggle', authMiddleware, isAdmin, toggleOfferStatus);

module.exports = router; 