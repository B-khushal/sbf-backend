const Offer = require('../models/Offer');

// Get all active offers
const getActiveOffers = async (req, res) => {
  try {
    const currentDate = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all offers (for admin)
const getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new offer
const createOffer = async (req, res) => {
  const offer = new Offer(req.body);
  try {
    const newOffer = await offer.save();
    res.status(201).json(newOffer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update offer
const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    Object.keys(req.body).forEach(key => {
      offer[key] = req.body[key];
    });

    const updatedOffer = await offer.save();
    res.json(updatedOffer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete offer
const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    await offer.deleteOne();
    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle offer status
const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    offer.isActive = !offer.isActive;
    const updatedOffer = await offer.save();
    
    res.json(updatedOffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Track offer impression
const trackOfferImpression = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    // Increment impressions count
    offer.impressions = (offer.impressions || 0) + 1;
    await offer.save();
    
    res.json({ success: true, impressions: offer.impressions });
  } catch (error) {
    console.error('Error tracking offer impression:', error);
    res.status(500).json({ message: error.message });
  }
};

// Track offer close
const trackOfferClose = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    // Increment closes count
    offer.closes = (offer.closes || 0) + 1;
    await offer.save();
    
    res.json({ success: true, closes: offer.closes });
  } catch (error) {
    console.error('Error tracking offer close:', error);
    res.status(500).json({ message: error.message });
  }
};

// Export all controller functions
module.exports = {
  getActiveOffers,
  getAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
  trackOfferImpression,
  trackOfferClose
}; 