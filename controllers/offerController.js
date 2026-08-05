const Offer = require('../models/Offer');
const PromoCode = require('../models/PromoCode');

const syncOfferPromoCode = async (offerData) => {
  if (!offerData || !offerData.code) return;
  const cleanCode = offerData.code.trim().toUpperCase();
  if (!cleanCode) return;

  const discountVal = offerData.discountPercent !== undefined && offerData.discountPercent !== null 
    ? Number(offerData.discountPercent) 
    : (offerData.discountPercentage ? Number(offerData.discountPercentage) : 10);

  const startDateVal = offerData.startDate ? new Date(offerData.startDate) : new Date();
  const endDateVal = offerData.endDate ? new Date(offerData.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const imageUrlVal = offerData.imageUrl || offerData.image || offerData.mobileImageUrl || null;
  const backgroundVal = offerData.background || null;

  try {
    const existing = await PromoCode.findOne({ code: cleanCode });
    if (existing) {
      existing.isActive = offerData.isActive !== undefined ? Boolean(offerData.isActive) : true;
      existing.discountValue = discountVal;
      existing.description = offerData.description || offerData.title || existing.description;
      existing.validFrom = startDateVal;
      existing.validUntil = endDateVal;
      existing.image = imageUrlVal || existing.image;
      existing.background = backgroundVal || existing.background;
      await existing.save();
      console.log(`✅ Synced PromoCode [${cleanCode}]: ${discountVal}% OFF | Valid: ${startDateVal.toISOString()} to ${endDateVal.toISOString()}`);
    } else {
      const newPromo = new PromoCode({
        code: cleanCode,
        description: offerData.description || offerData.title || 'Campaign Promo Code',
        discountType: 'percentage',
        discountValue: discountVal,
        minimumOrderAmount: 0,
        isActive: offerData.isActive !== undefined ? Boolean(offerData.isActive) : true,
        validFrom: startDateVal,
        validUntil: endDateVal,
        image: imageUrlVal,
        background: backgroundVal
      });
      await newPromo.save();
      console.log(`✅ Created & Synced new PromoCode [${cleanCode}]: ${discountVal}% OFF`);
    }
  } catch (err) {
    console.warn('Sync offer promo code warning:', err.message);
  }
};

const getActiveOffers = async (req, res) => {
  try {
    const currentDate = new Date();
    const allActive = await Offer.find({ isActive: true });
    const validOffers = allActive.filter(offer => {
      if (offer.startDate && new Date(offer.startDate) > currentDate) return false;
      if (offer.endDate && new Date(offer.endDate) < currentDate) return false;
      return true;
    });
    res.json(validOffers);
  } catch (error) {
    console.error('Error fetching active offers:', error);
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
    await syncOfferPromoCode(newOffer);
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
    await syncOfferPromoCode(updatedOffer);
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
    
    // Increment variant metrics if matching variantId is provided
    const { variantId } = req.body;
    if (variantId && offer.variants && offer.variants.length > 0) {
      const variant = offer.variants.id(variantId);
      if (variant) {
        variant.impressions = (variant.impressions || 0) + 1;
      }
    }
    
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
    
    // Increment variant metrics if matching variantId is provided
    const { variantId } = req.body;
    if (variantId && offer.variants && offer.variants.length > 0) {
      const variant = offer.variants.id(variantId);
      if (variant) {
        variant.closes = (variant.closes || 0) + 1;
      }
    }
    
    await offer.save();
    res.json({ success: true, closes: offer.closes });
  } catch (error) {
    console.error('Error tracking offer close:', error);
    res.status(500).json({ message: error.message });
  }
};

// Track offer CTA click
const trackOfferCtaClick = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    offer.ctaClicks = (offer.ctaClicks || 0) + 1;
    
    const { variantId } = req.body;
    if (variantId && offer.variants && offer.variants.length > 0) {
      const variant = offer.variants.id(variantId);
      if (variant) {
        variant.ctaClicks = (variant.ctaClicks || 0) + 1;
      }
    }
    
    await offer.save();
    res.json({ success: true, ctaClicks: offer.ctaClicks });
  } catch (error) {
    console.error('Error tracking offer CTA click:', error);
    res.status(500).json({ message: error.message });
  }
};

// Track offer coupon copy
const trackOfferCouponCopy = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    offer.couponCopies = (offer.couponCopies || 0) + 1;
    
    const { variantId } = req.body;
    if (variantId && offer.variants && offer.variants.length > 0) {
      const variant = offer.variants.id(variantId);
      if (variant) {
        variant.couponCopies = (variant.couponCopies || 0) + 1;
      }
    }
    
    await offer.save();
    res.json({ success: true, couponCopies: offer.couponCopies });
  } catch (error) {
    console.error('Error tracking offer coupon copy:', error);
    res.status(500).json({ message: error.message });
  }
};

// Track offer conversion
const trackOfferConversion = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    offer.conversions = (offer.conversions || 0) + 1;
    
    const { variantId } = req.body;
    if (variantId && offer.variants && offer.variants.length > 0) {
      const variant = offer.variants.id(variantId);
      if (variant) {
        variant.conversions = (variant.conversions || 0) + 1;
      }
    }
    
    await offer.save();
    res.json({ success: true, conversions: offer.conversions });
  } catch (error) {
    console.error('Error tracking offer conversion:', error);
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
  trackOfferClose,
  trackOfferCtaClick,
  trackOfferCouponCopy,
  trackOfferConversion
}; 