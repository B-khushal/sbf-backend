const ValentineSettings = require('../models/ValentineSettings');
const ValentineOffer = require('../models/ValentineOffer');
const Product = require('../models/Product');
const Order = require('../models/Order');

// ============================================================
//  PUBLIC ENDPOINTS
// ============================================================

// GET /api/valentine/status - lightweight status check
const getValentineStatus = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();
    res.json({
      enabled: settings.enabled,
      campaignName: settings.general.campaignName,
      startDate: settings.general.startDate,
      endDate: settings.general.endDate,
      countdownTargetDate: settings.general.countdownTargetDate,
      mobileNavigation: settings.mobileNavigation
    });
  } catch (error) {
    console.error('Error getting valentine status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/settings - full public settings
const getValentineSettings = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();

    // If not enabled and not admin, return minimal response
    if (!settings.enabled) {
      const isAdmin = req.user && req.user.role === 'admin';
      if (!isAdmin) {
        return res.json({ 
          enabled: false,
          mobileNavigation: settings.mobileNavigation
        });
      }
    }

    // Populate product refs in timeline
    await settings.populate('timeline.products');
    await settings.populate('timeline.offers');

    res.json(settings);
  } catch (error) {
    console.error('Error getting valentine settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/timeline - public timeline with products
const getTimeline = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.json({ enabled: false, timeline: [] });
    }

    const timeline = settings.timeline
      .filter(card => card.enabled)
      .sort((a, b) => a.order - b.order);

    // Populate products for each card
    await ValentineSettings.populate(timeline, { path: 'products' });
    await ValentineSettings.populate(timeline, { path: 'offers' });

    res.json({ enabled: true, timeline });
  } catch (error) {
    console.error('Error getting valentine timeline:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/products/:dateSlug - products for a specific date
const getProductsByDate = async (req, res) => {
  try {
    const { dateSlug } = req.params;
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.json({ enabled: false, products: [] });
    }

    const products = await Product.find({
      isValentineProduct: true,
      availableDates: dateSlug,
      hidden: { $ne: true },
      approvalStatus: 'approved'
    }).sort({ createdAt: -1 });

    res.json({ enabled: true, products });
  } catch (error) {
    console.error('Error getting valentine products by date:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/products - all valentine products
const getAllValentineProducts = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.json({ enabled: false, products: [] });
    }

    const { category, dateSlug, limit = 50, page = 1 } = req.query;
    const filter = {
      hidden: { $ne: true },
      approvalStatus: 'approved',
      isValentineProduct: true
    };

    if (category) {
      // Find case-insensitive match for category in the array or as a single value
      filter.$or = [
        { valentineCategories: { $regex: new RegExp('^' + category.replace(/-/g, ' ') + '$', 'i') } },
        { valentineCategory: { $regex: new RegExp('^' + category.replace(/-/g, ' ') + '$', 'i') } },
        { category: { $regex: new RegExp('^' + category.replace(/-/g, ' ') + '$', 'i') } }
      ];
    }
    
    if (dateSlug) {
      filter.$or = [
        { availableDates: dateSlug },
        { valentineDate: dateSlug }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      enabled: true,
      products,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting valentine products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/offers - active offers
const getOffers = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.json({ enabled: false, offers: [] });
    }

    const offers = await ValentineOffer.getActiveOffers();
    res.json({ enabled: true, offers });
  } catch (error) {
    console.error('Error getting valentine offers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/gift-builder/items - gift builder items
const getGiftBuilderItems = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.json({ enabled: false, items: [] });
    }

    const items = settings.giftBuilderItems
      .filter(item => item.enabled && item.stock > 0)
      .sort((a, b) => a.order - b.order);

    // Group by category
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    res.json({ enabled: true, items, grouped });
  } catch (error) {
    console.error('Error getting gift builder items:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/valentine/gift-builder/calculate - calculate gift price
const calculateGiftPrice = async (req, res) => {
  try {
    const { selectedItems } = req.body; // Array of item IDs
    const settings = await ValentineSettings.getSettings();

    if (!settings.enabled) {
      return res.status(400).json({ message: 'Valentine mode is not active' });
    }

    let total = 0;
    const breakdown = [];

    for (const itemId of selectedItems) {
      const item = settings.giftBuilderItems.find(i => i.id === itemId);
      if (item && item.enabled) {
        total += item.price;
        breakdown.push({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price
        });
      }
    }

    res.json({ total, breakdown, itemCount: breakdown.length });
  } catch (error) {
    console.error('Error calculating gift price:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============================================================
//  ADMIN ENDPOINTS
// ============================================================

// PUT /api/valentine/toggle - master toggle
const toggleValentine = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();
    settings.enabled = !settings.enabled;
    await settings.save();

    console.log(`🌹 Valentine Mode: ${settings.enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ enabled: settings.enabled, message: `Valentine mode ${settings.enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    console.error('Error toggling valentine:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/valentine/settings - update all settings
const updateSettings = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();
    const updates = req.body;

    // Update each section if provided
    if (updates.enabled !== undefined) settings.enabled = updates.enabled;
    if (updates.general) Object.assign(settings.general, updates.general);
    if (updates.theme) Object.assign(settings.theme, updates.theme);
    if (updates.timeline) settings.timeline = updates.timeline;
    if (updates.categories) settings.categories = updates.categories;
    if (updates.delivery) Object.assign(settings.delivery, updates.delivery);
    if (updates.giftBuilderItems) settings.giftBuilderItems = updates.giftBuilderItems;
    if (updates.seo) Object.assign(settings.seo, updates.seo);
    if (updates.marketing) Object.assign(settings.marketing, updates.marketing);
    if (updates.banners) settings.banners = updates.banners;
    if (updates.mobileNavigation) Object.assign(settings.mobileNavigation, updates.mobileNavigation);

    settings.markModified('general');
    settings.markModified('theme');
    settings.markModified('timeline');
    settings.markModified('categories');
    settings.markModified('delivery');
    settings.markModified('giftBuilderItems');
    settings.markModified('seo');
    settings.markModified('marketing');
    settings.markModified('banners');
    settings.markModified('mobileNavigation');

    await settings.save();

    res.json({ message: 'Valentine settings updated successfully', settings });
  } catch (error) {
    console.error('Error updating valentine settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/valentine/timeline/:id - update specific timeline card
const updateTimelineCard = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await ValentineSettings.getSettings();

    const cardIndex = settings.timeline.findIndex(c => c.id === id);
    if (cardIndex === -1) {
      return res.status(404).json({ message: 'Timeline card not found' });
    }

    Object.assign(settings.timeline[cardIndex], req.body);
    settings.markModified('timeline');
    await settings.save();

    res.json({ message: 'Timeline card updated', card: settings.timeline[cardIndex] });
  } catch (error) {
    console.error('Error updating timeline card:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/valentine/offers - create offer
const createOffer = async (req, res) => {
  try {
    const offer = await ValentineOffer.create(req.body);
    res.status(201).json({ message: 'Offer created', offer });
  } catch (error) {
    console.error('Error creating valentine offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/valentine/offers/:id - update offer
const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await ValentineOffer.findByIdAndUpdate(id, req.body, { new: true });
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json({ message: 'Offer updated', offer });
  } catch (error) {
    console.error('Error updating valentine offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/valentine/offers/:id - delete offer
const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await ValentineOffer.findByIdAndDelete(id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json({ message: 'Offer deleted' });
  } catch (error) {
    console.error('Error deleting valentine offer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/offers/all - all offers (admin)
const getAllOffers = async (req, res) => {
  try {
    const offers = await ValentineOffer.find().sort({ order: 1, createdAt: -1 });
    res.json({ offers });
  } catch (error) {
    console.error('Error getting all valentine offers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/valentine/products/:productId/assign - assign product to valentine date
const assignProductToDate = async (req, res) => {
  try {
    const { productId } = req.params;
    const { valentineDate, isValentineExclusive, valentineCategory } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (valentineDate !== undefined) product.valentineDate = valentineDate;
    if (isValentineExclusive !== undefined) product.isValentineExclusive = isValentineExclusive;
    if (valentineCategory !== undefined) product.valentineCategory = valentineCategory;

    await product.save();

    res.json({ message: 'Product valentine assignment updated', product });
  } catch (error) {
    console.error('Error assigning product to valentine date:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/analytics - analytics dashboard data
const getAnalytics = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    // Valentine week: Feb 8 - Feb 15
    const startDate = new Date(targetYear, 1, 8, 0, 0, 0);
    const endDate = new Date(targetYear, 1, 15, 23, 59, 59);

    // Get orders during valentine week
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const conversionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;

    // Daily breakdown
    const dailyData = [];
    for (let day = 8; day <= 15; day++) {
      const dayStart = new Date(targetYear, 1, day, 0, 0, 0);
      const dayEnd = new Date(targetYear, 1, day, 23, 59, 59);
      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const dayNames = {
        8: 'Rose Day', 9: 'Propose Day', 10: 'Chocolate Day', 11: 'Teddy Day',
        12: 'Promise Day', 13: 'Hug Day', 14: "Valentine's Day", 15: 'Celebration Day'
      };

      dailyData.push({
        date: `Feb ${day}`,
        name: dayNames[day],
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
      });
    }

    // Get valentine products ordered (products with valentine fields)
    const valentineProducts = await Product.find({
      $or: [
        { valentineDate: { $ne: null } },
        { isValentineExclusive: true },
        { valentineCategory: { $ne: '' } }
      ]
    }).select('title price valentineDate valentineCategory');

    // Get valentine offers
    const valentineOffers = await ValentineOffer.find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    });

    res.json({
      period: { startDate, endDate, year: targetYear },
      summary: {
        totalOrders,
        totalRevenue,
        completedOrders,
        conversionRate: parseFloat(conversionRate),
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      },
      dailyData,
      topProducts: valentineProducts.slice(0, 10),
      activeOffers: valentineOffers.length,
      offersUsage: valentineOffers.map(o => ({
        title: o.title,
        type: o.type,
        usageCount: o.usageCount
      }))
    });
  } catch (error) {
    console.error('Error getting valentine analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  // Public
  getValentineStatus,
  getValentineSettings,
  getTimeline,
  getProductsByDate,
  getAllValentineProducts,
  getOffers,
  getGiftBuilderItems,
  calculateGiftPrice,
  // Admin
  toggleValentine,
  updateSettings,
  updateTimelineCard,
  createOffer,
  updateOffer,
  deleteOffer,
  getAllOffers,
  assignProductToDate,
  getAnalytics
};
