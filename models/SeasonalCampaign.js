const prisma = require('../config/prisma');

const defaultNav = {
  showInNavbar: true,
  showInNavigationMenu: true,
  showInHomepage: true,
  showInAnnouncementBar: true,
  showInMobileNavbar: true,
  showInFeaturedSection: true
};

const defaultDelivery = {
  sameDayEnabled: true,
  sameDayCharge: 0,
  midnightEnabled: true,
  midnightCharge: 150
};

class SeasonalCampaignDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.name = data.name || data.title || 'Seasonal Campaign';
    this.title = data.title || data.name || 'Seasonal Campaign';
    this.enabled = data.enabled !== undefined ? Boolean(data.enabled) : (data.isActive !== undefined ? Boolean(data.isActive) : false);
    this.isActive = this.enabled;

    this.general = data.general || {
      campaignName: this.name,
      startDate: data.startDate || new Date('2026-01-01'),
      endDate: data.endDate || new Date('2026-12-31')
    };

    this.analytics = data.analytics || {
      pageViews: 0,
      traffic: 0,
      conversions: 0,
      revenue: 0
    };

    this.theme = data.theme || { primaryColor: '#E91E63' };
    this.navigation = Object.assign({}, defaultNav, data.navigation || {});
    this.delivery = Object.assign({}, defaultDelivery, data.delivery || {});
    this.banners = data.banners || [];
    this.offers = data.offers || [];
    this.categories = data.categories || [];
    this.seo = data.seo || {};
  }

  markModified(path) {
    return this;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      name: this.name,
      slug: this.slug,
      title: this.title || this.name,
      description: this.description,
      bannerUrl: this.bannerUrl,
      enabled: this.enabled,
      isActive: this.enabled !== false,
      general: this.general,
      analytics: this.analytics,
      theme: this.theme,
      navigation: Object.assign({}, defaultNav, this.navigation || {}),
      delivery: Object.assign({}, defaultDelivery, this.delivery || {}),
      banners: this.banners,
      offers: this.offers,
      categories: this.categories,
      seo: this.seo,
      config: this.config || {},
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const scId = this.id || this._id;
    const isAct = this.enabled !== undefined ? Boolean(this.enabled) : Boolean(this.isActive);

    const updated = await prisma.seasonalCampaign.upsert({
      where: { id: scId },
      update: {
        title: this.title || this.name,
        name: this.name || this.title,
        slug: this.slug,
        description: this.description || null,
        bannerUrl: this.bannerUrl || null,
        enabled: isAct,
        isActive: isAct,
        general: this.general || undefined,
        theme: this.theme || undefined,
        navigation: this.navigation || undefined,
        banners: this.banners || undefined,
        categories: this.categories || undefined,
        offers: this.offers || undefined,
        delivery: this.delivery || undefined,
        seo: this.seo || undefined,
        analytics: this.analytics || undefined,
        config: this.config || undefined
      },
      create: {
        id: scId || `sc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: this.title || this.name || 'Campaign',
        name: this.name || this.title || 'Campaign',
        slug: this.slug || `campaign-${Date.now()}`,
        description: this.description || null,
        bannerUrl: this.bannerUrl || null,
        enabled: isAct,
        isActive: isAct,
        general: this.general || undefined,
        theme: this.theme || undefined,
        navigation: this.navigation || undefined,
        banners: this.banners || undefined,
        categories: this.categories || undefined,
        offers: this.offers || undefined,
        delivery: this.delivery || undefined,
        seo: this.seo || undefined,
        analytics: this.analytics || undefined,
        config: this.config || undefined
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    this.enabled = updated.enabled && updated.isActive;
    this.isActive = updated.enabled && updated.isActive;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(c => new SeasonalCampaignDocument(c)));
      else if (res) resolve(new SeasonalCampaignDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class SeasonalCampaignModel {
  static async countDocuments(where = {}) {
    const filter = {};
    if (where.enabled !== undefined) filter.enabled = Boolean(where.enabled);
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);
    return await prisma.seasonalCampaign.count({ where: filter });
  }

  static async seedDefaultCampaigns() {
    const count = await this.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding default seasonal campaigns...');
      await prisma.seasonalCampaign.create({
        data: {
          id: `sc_${Date.now()}`,
          title: 'Spring Blossom Special',
          name: 'Spring Blossom Special',
          slug: 'spring-blossom-special',
          description: 'Special seasonal floral deals',
          enabled: false,
          isActive: false
        }
      });
      console.log('✅ Default seasonal campaign seeded successfully');
    }
  }

  static async syncOffers(campaign, userId) {
    return true;
  }

  static async create(data) {
    const scId = data.id || data._id || `sc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const slug = data.slug || `campaign-${Date.now()}`;
    const title = data.title || data.name || 'Campaign';
    const name = data.name || data.title || 'Campaign';
    const isAct = data.enabled !== undefined ? Boolean(data.enabled) : (data.isActive !== undefined ? Boolean(data.isActive) : false);

    const created = await prisma.seasonalCampaign.create({
      data: {
        id: scId,
        title: title,
        name: name,
        slug: slug,
        description: data.description || null,
        bannerUrl: data.bannerUrl || null,
        enabled: isAct,
        isActive: isAct,
        general: data.general || undefined,
        theme: data.theme || undefined,
        navigation: data.navigation || undefined,
        banners: data.banners || undefined,
        categories: data.categories || undefined,
        offers: data.offers || undefined,
        delivery: data.delivery || undefined,
        seo: data.seo || undefined
      }
    });

    return new SeasonalCampaignDocument(created);
  }

  static find(where = {}) {
    const filter = {};
    if (where.slug) filter.slug = where.slug;
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);
    if (where.enabled !== undefined) filter.enabled = Boolean(where.enabled);

    const query = prisma.seasonalCampaign.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.slug) filter.slug = where.slug;
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.seasonalCampaign.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.seasonalCampaign.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async findByIdAndDelete(id) {
    if (!id) return null;
    try {
      const deleted = await prisma.seasonalCampaign.delete({ where: { id: String(id) } });
      return new SeasonalCampaignDocument(deleted);
    } catch (e) {
      return null;
    }
  }
}

module.exports = SeasonalCampaignModel;
