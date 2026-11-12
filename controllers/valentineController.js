const ValentineSettings = require('../models/ValentineSettings');
const ValentineOffer = require('../models/ValentineOffer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const prisma = require('../config/prisma');

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

// GET /api/valentine/sections - 16 dynamic landing sections populated from real DB products
const getValentineSections = async (req, res) => {
  try {
    const settings = await ValentineSettings.getSettings();
    if (!settings.enabled) {
      return res.json({ enabled: false, sections: [] });
    }

    const sectionsConfig = (settings.sections || []).filter(s => s.enabled).sort((a, b) => a.order - b.order);

    // Fetch pool of active, approved products
    const activeProducts = await Product.find({
      hidden: { $ne: true },
      approvalStatus: 'approved'
    }).sort({ isFeatured: -1, isBestseller: -1, createdAt: -1 });

    // Review pool from prisma review or fallback
    let realReviews = [];
    try {
      realReviews = await prisma.review.findMany({
        where: { status: 'approved' },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, slug: true } } }
      });
    } catch (e) {
      realReviews = [];
    }

    const populatedSections = [];

    // Helper to prioritize products explicitly assigned by the Admin via productForm / bulk assign
    const getProductsForSection = (sectionId, fallbackFilter) => {
      const assigned = activeProducts.filter(p => {
        if (!Array.isArray(p.valentineSections)) return false;
        return p.valentineSections.some(s => {
          if (typeof s !== 'string') return false;
          const clean = s.toLowerCase().trim();
          const target = sectionId.toLowerCase().trim();
          return clean === target || clean === target.replace(/-/g, ' ') || clean.replace(/-/g, ' ') === target.replace(/-/g, ' ');
        });
      });

      if (assigned.length > 0) {
        if (assigned.length < 8 && fallbackFilter) {
          const assignedIds = new Set(assigned.map(p => String(p._id || p.id)));
          const extras = activeProducts.filter(p => !assignedIds.has(String(p._id || p.id)) && fallbackFilter(p)).slice(0, 8 - assigned.length);
          return [...assigned, ...extras];
        }
        return assigned.slice(0, 12);
      }

      return fallbackFilter ? activeProducts.filter(fallbackFilter).slice(0, 8) : [];
    };

    for (const section of sectionsConfig) {
      const secData = {
        id: section.id,
        name: section.name,
        enabled: section.enabled,
        order: section.order,
        empty: false,
        products: [],
        metadata: {}
      };

      switch (section.id) {
        case 'hero':
          secData.metadata = {
            campaignName: settings.general?.campaignName || "Valentine's Week",
            countdownTargetDate: settings.general?.countdownTargetDate || '2026-02-14T23:59:59',
            heroSlides: settings.heroSlides || [],
            theme: settings.theme || {}
          };
          break;

        case 'categories':
          secData.metadata = {
            categories: settings.categories?.filter(c => c.enabled) || []
          };
          break;

        case 'gift-finder':
          secData.metadata = {
            title: 'Find The Perfect Valentine Gift',
            subtitle: 'Curated recommendations for your special someone'
          };
          break;

        case 'bestsellers':
          secData.products = getProductsForSection('bestsellers', p => p.isBestseller || p.isFeatured || (p.rating && p.rating >= 4.5));
          if (secData.products.length === 0) {
            secData.products = activeProducts.slice(0, 8);
          }
          break;

        case 'roses':
          secData.products = getProductsForSection('roses', p => {
            const nameMatch = /rose/i.test(p.name || p.title || '');
            const catMatch = /rose/i.test(p.category || '') || (Array.isArray(p.categories) && p.categories.some(c => /rose/i.test(c)));
            return nameMatch || catMatch;
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'bouquets':
          secData.products = getProductsForSection('bouquets', p => {
            const nameMatch = /bouquet|bunch|arrangement/i.test(p.name || p.title || '');
            const catMatch = /bouquet|arrangements/i.test(p.category || '') || (Array.isArray(p.categories) && p.categories.some(c => /bouquet|arrangements/i.test(c)));
            return nameMatch || catMatch;
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'cakes-combos':
          secData.products = getProductsForSection('cakes-combos', p => {
            const nameMatch = /cake|pastry|truffle|cupcake/i.test(p.name || p.title || '');
            const catMatch = /cake/i.test(p.category || '') || (Array.isArray(p.categories) && p.categories.some(c => /cake/i.test(c)));
            return nameMatch || catMatch;
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'combos':
          secData.products = getProductsForSection('combos', p => {
            const nameMatch = /combo|hamper|basket|package/i.test(p.name || p.title || '');
            const catMatch = /combo|hamper|basket/i.test(p.category || '') || (Array.isArray(p.categories) && p.categories.some(c => /combo|hamper|basket/i.test(c)));
            return nameMatch || catMatch;
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'gifts-for-her':
          secData.products = getProductsForSection('gifts-for-her', p => {
            const str = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
            return /her|women|girlfriend|wife|pink|red|heart|teddy|rose|charm/i.test(str);
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'gifts-for-him':
          secData.products = getProductsForSection('gifts-for-him', p => {
            const str = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
            return /him|men|boyfriend|husband|plant|blue|black|chocolate|hamper|truffle/i.test(str);
          });
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'premium':
          secData.products = getProductsForSection('premium', p => (p.price && p.price >= 2000) || /luxury|premium|grand|exclusive/i.test(p.name || ''));
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'valentine-week':
          secData.metadata = {
            days: (settings.timeline || []).map(card => {
              const matchedProducts = activeProducts.filter(p => {
                if (Array.isArray(p.availableDates) && p.availableDates.includes(card.id)) return true;
                if (p.valentineDate === card.id) return true;
                if (card.id === 'rose-day' && /rose/i.test(p.name || p.category || '')) return true;
                if (card.id === 'chocolate-day' && /chocolate/i.test(p.name || p.category || '')) return true;
                if (card.id === 'teddy-day' && /teddy|hamper/i.test(p.name || p.category || '')) return true;
                return false;
              }).slice(0, 4);

              return {
                ...card,
                productsCount: matchedProducts.length,
                products: matchedProducts
              };
            })
          };
          break;

        case 'budget':
          secData.products = getProductsForSection('budget', p => p.price && p.price <= 1000);
          if (secData.products.length === 0) secData.empty = true;
          break;

        case 'reviews':
          secData.metadata = {
            reviews: realReviews
          };
          if (realReviews.length === 0) secData.empty = true;
          break;

        case 'why-choose':
        case 'faqs':
        case 'editorial':
          break;

        default:
          break;
      }

      populatedSections.push(secData);
    }

    res.json({
      enabled: true,
      campaignName: settings.general?.campaignName,
      sections: populatedSections
    });
  } catch (error) {
    console.error('Error getting valentine sections:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/gift-finder - interactive gift finder query
const getGiftFinderProducts = async (req, res) => {
  try {
    const { recipient, budget, category, occasion, sortBy, page = 1, limit = 12 } = req.query;

    const allApproved = await Product.find({
      hidden: { $ne: true },
      approvalStatus: 'approved'
    });

    let filtered = allApproved;

    // Filter by budget
    if (budget && budget !== 'all') {
      if (budget === 'under-1000') {
        filtered = filtered.filter(p => (p.price || 0) <= 1000);
      } else if (budget === '1000-2000') {
        filtered = filtered.filter(p => (p.price || 0) >= 1000 && (p.price || 0) <= 2000);
      } else if (budget === '2000-3500') {
        filtered = filtered.filter(p => (p.price || 0) >= 2000 && (p.price || 0) <= 3500);
      } else if (budget === 'luxury' || budget === 'above-3500') {
        filtered = filtered.filter(p => (p.price || 0) > 3500);
      }
    }

    // Filter by category
    if (category && category !== 'all') {
      const cleanCat = String(category).toLowerCase().replace(/-/g, ' ');
      filtered = filtered.filter(p => {
        const prodCat = String(p.category || '').toLowerCase();
        const prodCats = Array.isArray(p.categories) ? p.categories.map(c => String(c).toLowerCase()) : [];
        const prodValCats = Array.isArray(p.valentineCategories) ? p.valentineCategories.map(c => String(c).toLowerCase()) : [];
        return prodCat.includes(cleanCat) || prodCats.some(c => c.includes(cleanCat)) || prodValCats.some(c => c.includes(cleanCat)) || (p.name || '').toLowerCase().includes(cleanCat);
      });
    }

    // Filter by recipient
    if (recipient && recipient !== 'anyone' && recipient !== 'all') {
      const rec = String(recipient).toLowerCase();
      filtered = filtered.filter(p => {
        const text = `${p.name || ''} ${p.description || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        if (rec === 'girlfriend' || rec === 'wife' || rec === 'her') {
          return /her|girlfriend|wife|rose|flower|bouquet|pink|red|heart|teddy|combo/i.test(text);
        } else if (rec === 'boyfriend' || rec === 'husband' || rec === 'him') {
          return /him|boyfriend|husband|cake|plant|chocolate|hamper|black|blue|combo|sweet/i.test(text);
        } else if (rec === 'friend') {
          return /yellow|friend|cheerful|bright|combo|plant|chocolate|cake/i.test(text);
        } else if (rec === 'parents') {
          return /plant|fruit|traditional|pure|peace|lily|orchid|hamper/i.test(text);
        }
        return true;
      });
    }

    // Filter by occasion
    if (occasion && occasion !== 'all') {
      const occ = String(occasion).toLowerCase().replace(/-/g, ' ');
      filtered = filtered.filter(p => {
        const text = `${p.name || ''} ${p.valentineDate || ''} ${(p.availableDates || []).join(' ')} ${(p.occasions || []).join(' ')}`.toLowerCase();
        return text.includes(occ) || text.includes(occasion);
      });
    }

    // Sort
    if (sortBy === 'price-low') {
      filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || b.averageRating || 0) - (a.rating || a.averageRating || 0));
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else {
      filtered.sort((a, b) => {
        const aScore = (a.isBestseller ? 2 : 0) + (a.isFeatured ? 1 : 0);
        const bScore = (b.isBestseller ? 2 : 0) + (b.isFeatured ? 1 : 0);
        return bScore - aScore;
      });
    }

    const total = filtered.length;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products: paginated
    });
  } catch (error) {
    console.error('Error querying gift finder products:', error);
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

    const { category, dateSlug, limit = 100, page = 1, isValentineOnly = 'false' } = req.query;
    
    // Fetch approved, visible products
    const allApproved = await Product.find({
      hidden: { $ne: true },
      approvalStatus: 'approved'
    }).sort({ isFeatured: -1, isBestseller: -1, createdAt: -1 });

    let filtered = allApproved;

    // Filter to Valentine & romantic seasonal pool
    if (isValentineOnly === 'true') {
      filtered = filtered.filter(p => p.isValentineProduct || p.showInValentineShop);
    } else {
      filtered = filtered.filter(p => {
        if (p.isValentineProduct || p.showInValentineShop || p.valentineDate || (Array.isArray(p.availableDates) && p.availableDates.length > 0)) {
          return true;
        }
        const text = `${p.name || ''} ${p.category || ''} ${(p.categories || []).join(' ')} ${(p.occasions || []).join(' ')} ${(p.tags || []).join(' ')}`.toLowerCase();
        return /valentine|rose|romance|romantic|anniversary|love|bouquet|heart|combo|hamper/i.test(text);
      });
    }

    if (category && category !== 'all') {
      const cleanCat = String(category).toLowerCase().replace(/-/g, ' ');
      filtered = filtered.filter(p => {
        const prodCat = String(p.category || '').toLowerCase();
        const prodCats = Array.isArray(p.categories) ? p.categories.map(c => String(c).toLowerCase()) : [];
        const prodValCats = Array.isArray(p.valentineCategories) ? p.valentineCategories.map(c => String(c).toLowerCase()) : [];
        return prodCat.includes(cleanCat) || prodCats.some(c => c.includes(cleanCat)) || prodValCats.some(c => c.includes(cleanCat)) || (p.name || '').toLowerCase().includes(cleanCat);
      });
    }

    if (dateSlug && dateSlug !== 'all') {
      filtered = filtered.filter(p => {
        if (Array.isArray(p.availableDates) && p.availableDates.includes(dateSlug)) return true;
        if (p.valentineDate === dateSlug) return true;
        // Thematic matching fallback for days
        if (dateSlug === 'rose-day') return /rose/i.test(p.name || p.category || '');
        if (dateSlug === 'chocolate-day') return /chocolate/i.test(p.name || p.category || '');
        if (dateSlug === 'teddy-day') return /teddy|hamper/i.test(p.name || p.category || '');
        return false;
      });
    }

    const total = filtered.length;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      enabled: true,
      products: paginated,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
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

// GET /api/valentine/catalog - Admin product management catalog
const getValentineCatalogAdmin = async (req, res) => {
  try {
    const { search = '', category = '', dateSlug = '', isValentineOnly = 'false', page = 1, limit = 20 } = req.query;

    const allApproved = await Product.find({
      approvalStatus: 'approved'
    }).sort({ updatedAt: -1 });

    let filtered = allApproved;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p => (p.name || p.title || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }

    if (category && category !== 'all') {
      const cat = category.toLowerCase();
      filtered = filtered.filter(p => (p.category || '').toLowerCase().includes(cat) || (Array.isArray(p.categories) && p.categories.some(c => String(c).toLowerCase().includes(cat))));
    }

    if (dateSlug && dateSlug !== 'all') {
      filtered = filtered.filter(p => (Array.isArray(p.availableDates) && p.availableDates.includes(dateSlug)) || p.valentineDate === dateSlug);
    }

    if (isValentineOnly === 'true') {
      filtered = filtered.filter(p => p.isValentineProduct || p.showInValentineShop);
    }

    const total = filtered.length;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products: paginated
    });
  } catch (error) {
    console.error('Error getting valentine catalog for admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/valentine/products/bulk-assign - Bulk assign/update products
const bulkAssignValentineProducts = async (req, res) => {
  try {
    const { productIds, updates } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'No product IDs provided' });
    }

    let updatedCount = 0;
    for (const id of productIds) {
      const prod = await Product.findById(id);
      if (prod) {
        if (updates.isValentineProduct !== undefined) prod.isValentineProduct = Boolean(updates.isValentineProduct);
        if (updates.showInValentineShop !== undefined) prod.showInValentineShop = Boolean(updates.showInValentineShop);
        if (updates.productType === 'regular' || updates.productType === 'valentine') {
          prod.productType = updates.productType;
        } else if (updates.isValentineProduct !== undefined) {
          prod.productType = Boolean(updates.isValentineProduct) ? 'valentine' : 'regular';
        }
        if (updates.isValentineExclusive !== undefined) prod.isValentineExclusive = Boolean(updates.isValentineExclusive);
        if (updates.valentineDate !== undefined) prod.valentineDate = updates.valentineDate;
        if (updates.availableDates !== undefined) prod.availableDates = updates.availableDates;
        if (updates.valentineCategory !== undefined) prod.valentineCategory = updates.valentineCategory;
        if (updates.valentineCategories !== undefined) prod.valentineCategories = updates.valentineCategories;
        if (updates.valentineBadge !== undefined) prod.valentineBadge = updates.valentineBadge;
        await prod.save();
        updatedCount++;
      }
    }

    res.json({ message: `Successfully updated ${updatedCount} products`, updatedCount });
  } catch (error) {
    console.error('Error bulk assigning valentine products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/valentine/sections - update landing sections config
const updateValentineSections = async (req, res) => {
  try {
    const { sections } = req.body;
    if (!Array.isArray(sections)) {
      return res.status(400).json({ message: 'Sections array required' });
    }

    const settings = await ValentineSettings.getSettings();
    settings.sections = sections;
    settings.markModified('sections');
    await settings.save();

    res.json({ message: 'Valentine sections updated successfully', sections: settings.sections });
  } catch (error) {
    console.error('Error updating valentine sections:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/valentine/analytics - analytics dashboard data
const getAnalytics = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    // Valentine week: Feb 7 - Feb 15
    const startDate = new Date(targetYear, 1, 7, 0, 0, 0);
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

    // Daily breakdown for Valentine Week: Feb 7 - Feb 15
    const dailyData = [];
    const dayNames = {
      7: 'Rose Day',
      8: 'Propose Day',
      9: 'Chocolate Day',
      10: 'Teddy Day',
      11: 'Promise Day',
      12: 'Hug Day',
      13: 'Kiss Day',
      14: "Valentine's Day",
      15: 'Celebration Day'
    };
    for (let day = 7; day <= 15; day++) {
      const dayStart = new Date(targetYear, 1, day, 0, 0, 0);
      const dayEnd = new Date(targetYear, 1, day, 23, 59, 59);
      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);

      dailyData.push({
        date: `Feb ${day}`,
        name: dayNames[day] || `Feb ${day}`,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
      });
    }

    // Get valentine products ordered
    const valentineProducts = await Product.find({
      $or: [
        { valentineDate: { $ne: null } },
        { isValentineExclusive: true },
        { isValentineProduct: true },
        { showInValentineShop: true }
      ]
    }).select('title name price valentineDate valentineCategory');

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
  getValentineSections,
  getGiftFinderProducts,
  getProductsByDate,
  getAllValentineProducts,
  getOffers,
  getGiftBuilderItems,
  calculateGiftPrice,
  // Admin
  getValentineCatalogAdmin,
  bulkAssignValentineProducts,
  updateValentineSections,
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
