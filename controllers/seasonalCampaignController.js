const SeasonalCampaign = require('../models/SeasonalCampaign');
const Product = require('../models/Product');
const Order = require('../models/Order');
const PromoCode = require('../models/PromoCode');

// ============================================================
//  PUBLIC ENDPOINTS
// ============================================================

// GET /api/seasonal-campaigns/status - Lightweight check of all campaigns with product counts
const getActiveCampaignsStatus = async (req, res) => {
  try {
    const campaigns = await SeasonalCampaign.find({}).select(
      'name slug enabled general theme navigation banners offers categories seo'
    );
    
    // Add product counts dynamically
    const campaignsWithCounts = await Promise.all(campaigns.map(async (campaign) => {
      const count = await Product.countDocuments({
        seasonalCampaigns: campaign.slug,
        hidden: { $ne: true },
        approvalStatus: 'approved'
      });
      
      const doc = campaign.toObject();
      doc.productCount = count;
      return doc;
    }));

    res.json({ success: true, campaigns: campaignsWithCounts });
  } catch (error) {
    console.error('Error getting campaigns status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seasonal-campaigns/settings/:slug - Full settings + products for a campaign
const getCampaignSettings = async (req, res) => {
  try {
    const { slug } = req.params;
    const campaign = await SeasonalCampaign.findOne({ slug });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const products = await Product.find({
      seasonalCampaigns: slug,
      hidden: { $ne: true },
      approvalStatus: 'approved',
      isValentineProduct: { $ne: true },
      productType: { $ne: 'valentine' }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      campaign,
      products
    });
  } catch (error) {
    console.error(`Error getting settings for campaign ${req.params.slug}:`, error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/seasonal-campaigns/view/:id - Increment pageViews and track traffic
const trackCampaignView = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await SeasonalCampaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    campaign.analytics.pageViews = (campaign.analytics.pageViews || 0) + 1;
    campaign.analytics.traffic = (campaign.analytics.traffic || 0) + 1;
    await campaign.save();

    res.json({ success: true, pageViews: campaign.analytics.pageViews });
  } catch (error) {
    console.error('Error tracking campaign view:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ============================================================
//  ADMIN ENDPOINTS (Protected)
// ============================================================

// GET /api/seasonal-campaigns/admin/all - Get all campaigns with statistics (for dashboard cards)
const adminGetAllCampaigns = async (req, res) => {
  try {
    const campaigns = await SeasonalCampaign.find({}).sort({ createdAt: -1 });
    
    // We will dynamically compute statistics for each campaign based on orders
    const campaignsWithStats = await Promise.all(campaigns.map(async (campaign) => {
      let orderCount = 0;
      let revenue = 0;

      if (campaign.general.startDate && campaign.general.endDate) {
        // Query orders placed during this campaign's date range
        const orders = await Order.find({
          createdAt: { $gte: campaign.general.startDate, $lte: campaign.general.endDate }
        });

        // Filter orders that contain products belonging to this campaign
        const campaignOrders = [];
        for (const order of orders) {
          let containsCampaignProduct = false;
          if (order.orderItems && order.orderItems.length > 0) {
            const productIds = order.orderItems.map(item => item.product);
            const campaignProducts = await Product.find({
              _id: { $in: productIds },
              seasonalCampaigns: campaign.slug
            });
            if (campaignProducts.length > 0) {
              containsCampaignProduct = true;
            }
          }
          if (containsCampaignProduct) {
            campaignOrders.push(order);
          }
        }

        orderCount = campaignOrders.length;
        revenue = campaignOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      }

      // Load product count
      const productCount = await Product.countDocuments({
        seasonalCampaigns: campaign.slug
      });

      // Update analytics counters in the DB doc to persist
      campaign.analytics.orders = orderCount;
      campaign.analytics.revenue = revenue;
      await campaign.save();

      const doc = campaign.toObject();
      doc.productCount = productCount;
      doc.ordersCount = orderCount;
      doc.revenue = revenue;

      return doc;
    }));

    res.json({ success: true, campaigns: campaignsWithStats });
  } catch (error) {
    console.error('Error getting all campaigns for admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/seasonal-campaigns/admin - Create a new occasion/campaign
const adminCreateCampaign = async (req, res) => {
  try {
    const { name, slug, general, theme, navigation, seo } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and URL slug are required' });
    }

    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await SeasonalCampaign.findOne({ slug: normalizedSlug });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A campaign with this URL slug already exists' });
    }

    const campaign = await SeasonalCampaign.create({
      name,
      slug: normalizedSlug,
      general: general || {},
      theme: theme || {},
      navigation: navigation || {
        showInHomepage: true,
        showInNavigationMenu: true,
        showInMobileNavbar: true,
        showInAnnouncementBar: true,
        showInFeaturedSection: true
      },
      seo: seo || {},
      banners: [
        { id: `${normalizedSlug}-hero`, title: `${name} Specials`, subtitle: 'Send fresh blooms today', image: '', link: `/${normalizedSlug}`, position: 'hero', enabled: true },
        { id: `${normalizedSlug}-announcement`, title: `🎉 Celebrate ${name} with SBF!`, subtitle: 'Order now', link: `/${normalizedSlug}`, position: 'announcement', enabled: true }
      ],
      categories: [],
      offers: []
    });

    await SeasonalCampaign.syncOffers(campaign, req.user._id);

    res.status(201).json({ success: true, message: 'Seasonal campaign created successfully', campaign });
  } catch (error) {
    console.error('Error creating seasonal campaign:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/seasonal-campaigns/admin/:id - Update campaign settings
const adminUpdateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const campaign = await SeasonalCampaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const originalSlug = campaign.slug;

    // Block changes to slug that would conflict with other campaigns
    if (updates.slug && updates.slug !== campaign.slug) {
      const normalizedSlug = updates.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const existing = await SeasonalCampaign.findOne({ slug: normalizedSlug, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A campaign with this URL slug already exists' });
      }
      campaign.slug = normalizedSlug;
    }

    if (updates.name !== undefined) campaign.name = updates.name;
    if (updates.enabled !== undefined) campaign.enabled = updates.enabled;
    if (updates.general) Object.assign(campaign.general, updates.general);
    if (updates.theme) Object.assign(campaign.theme, updates.theme);
    if (updates.navigation) Object.assign(campaign.navigation, updates.navigation);
    if (updates.delivery) Object.assign(campaign.delivery, updates.delivery);
    if (updates.seo) Object.assign(campaign.seo, updates.seo);
    
    if (updates.banners !== undefined) campaign.banners = updates.banners;
    if (updates.categories !== undefined) campaign.categories = updates.categories;
    if (updates.offers !== undefined) campaign.offers = updates.offers;

    campaign.markModified('general');
    campaign.markModified('theme');
    campaign.markModified('navigation');
    campaign.markModified('delivery');
    campaign.markModified('seo');
    campaign.markModified('banners');
    campaign.markModified('categories');
    campaign.markModified('offers');

    await campaign.save();

    await SeasonalCampaign.syncOffers(campaign, req.user._id);

    if (originalSlug !== campaign.slug) {
      const assignedProducts = await Product.find({
        $or: [
          { seasonalCampaigns: originalSlug },
          { [`campaignSettings.${originalSlug}`]: { $exists: true } }
        ]
      });

      await Promise.all(assignedProducts.map(async (product) => {
        const updatedCampaigns = (product.seasonalCampaigns || []).map((slug) =>
          slug === originalSlug ? campaign.slug : slug
        );

        const currentSettings = product.campaignSettings instanceof Map
          ? Object.fromEntries(product.campaignSettings.entries())
          : { ...(product.campaignSettings || {}) };

        if (Object.prototype.hasOwnProperty.call(currentSettings, originalSlug)) {
          currentSettings[campaign.slug] = currentSettings[originalSlug];
          delete currentSettings[originalSlug];
        }

        product.seasonalCampaigns = updatedCampaigns;
        product.campaignSettings = currentSettings;
        product.markModified('campaignSettings');
        await product.save();
      }));
    }

    res.json({ success: true, message: 'Campaign updated successfully', campaign });
  } catch (error) {
    console.error(`Error updating campaign ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/seasonal-campaigns/admin/:id - Delete a campaign
const adminDeleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await SeasonalCampaign.findByIdAndDelete(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Delete all synced promo codes belonging to this campaign
    await PromoCode.deleteMany({ 'metadata.campaignName': campaign.name });

    // Also remove this campaign slug from all assigned products
    await Product.updateMany(
      {
        $or: [
          { seasonalCampaigns: campaign.slug },
          { [`campaignSettings.${campaign.slug}`]: { $exists: true } }
        ]
      },
      {
        $pull: { seasonalCampaigns: campaign.slug },
        $unset: { [`campaignSettings.${campaign.slug}`]: 1 }
      }
    );

    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error(`Error deleting campaign ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/seasonal-campaigns/admin/:id/analytics - Fetch full performance metrics
const adminGetCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await SeasonalCampaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const startDate = campaign.general.startDate || new Date(new Date().getFullYear(), 0, 1);
    const endDate = campaign.general.endDate || new Date();

    // Query orders in campaign range
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Filter orders which contain products assigned to this campaign
    const campaignOrders = [];
    for (const order of orders) {
      if (order.orderItems && order.orderItems.length > 0) {
        const productIds = order.orderItems.map(item => item.product);
        const count = await Product.countDocuments({
          _id: { $in: productIds },
          seasonalCampaigns: campaign.slug
        });
        if (count > 0) {
          campaignOrders.push(order);
        }
      }
    }

    const totalOrders = campaignOrders.length;
    const totalRevenue = campaignOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const completedOrders = campaignOrders.filter(o => o.status === 'delivered').length;
    const pageViews = campaign.analytics.pageViews || 0;
    const conversionRate = pageViews > 0 ? ((totalOrders / pageViews) * 100).toFixed(1) : 0;

    // Get list of top products by sales
    const productsInCampaign = await Product.find({ seasonalCampaigns: campaign.slug });
    const productStats = productsInCampaign.map(p => {
      // Calculate units sold
      let unitsSold = 0;
      let revenue = 0;
      campaignOrders.forEach(o => {
        const item = o.orderItems.find(oi => String(oi.product) === String(p._id));
        if (item) {
          unitsSold += (item.qty || 1);
          revenue += (item.price || p.price) * (item.qty || 1);
        }
      });
      return {
        _id: p._id,
        title: p.title,
        price: p.price,
        unitsSold,
        revenue
      };
    }).sort((a, b) => b.unitsSold - a.unitsSold);

    res.json({
      success: true,
      summary: {
        totalOrders,
        totalRevenue,
        completedOrders,
        conversionRate: parseFloat(conversionRate),
        pageViews,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      },
      topProducts: productStats.slice(0, 10),
      offersUsage: campaign.offers.map(o => ({
        title: o.title,
        code: o.code,
        type: o.type,
        // Since we don't have general code tracking, we can return dummy or count from orders if code matches
        usageCount: 0
      }))
    });
  } catch (error) {
    console.error(`Error getting analytics for campaign ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getActiveCampaignsStatus,
  getCampaignSettings,
  trackCampaignView,
  adminGetAllCampaigns,
  adminCreateCampaign,
  adminUpdateCampaign,
  adminDeleteCampaign,
  adminGetCampaignAnalytics
};
