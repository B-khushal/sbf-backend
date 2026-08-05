const prisma = require('../config/prisma');

function cleanOfferWhere(where = {}) {
  const filter = {};
  if (!where || typeof where !== 'object') return filter;

  if (where.isActive !== undefined) {
    filter.isActive = Boolean(where.isActive);
  }

  if (where.code) {
    filter.code = String(where.code);
  }

  if (where._id || where.id) {
    const idVal = where._id || where.id;
    if (typeof idVal === 'string') {
      filter.id = String(idVal);
    }
  }

  if (where.startDate) {
    if (where.startDate.$lte) {
      filter.startDate = { ...(filter.startDate || {}), lte: new Date(where.startDate.$lte) };
    }
    if (where.startDate.$gte) {
      filter.startDate = { ...(filter.startDate || {}), gte: new Date(where.startDate.$gte) };
    }
  }

  if (where.endDate) {
    if (where.endDate.$lte) {
      filter.endDate = { ...(filter.endDate || {}), lte: new Date(where.endDate.$lte) };
    }
    if (where.endDate.$gte) {
      filter.endDate = { ...(filter.endDate || {}), gte: new Date(where.endDate.$gte) };
    }
  }

  return filter;
}

class OfferDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `offer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.title = data.title || '';
    this.subtitle = data.subtitle || null;
    this.description = data.description || '';
    this.code = data.code || null;
    this.discountPercentage = data.discountPercentage !== undefined && data.discountPercentage !== null ? parseFloat(data.discountPercentage) : null;
    this.discountPercent = data.discountPercent !== undefined && data.discountPercent !== null ? parseInt(data.discountPercent, 10) : (data.discountPercentage ? parseInt(data.discountPercentage, 10) : 0);
    this.image = data.image || data.imageUrl || null;
    this.imageUrl = this.image;
    this.mobileImageUrl = data.mobileImageUrl || null;
    this.banner = data.banner || null;
    this.background = data.background || 'linear-gradient(to right, #ff9966, #ff5e62)';
    this.textColor = data.textColor || '#ffffff';
    this.buttonText = data.buttonText || 'Explore Collection';
    this.buttonLink = data.buttonLink || '/shop';
    this.secondaryCtaText = data.secondaryCtaText || null;
    this.secondaryCtaLink = data.secondaryCtaLink || null;
    this.startDate = data.startDate ? new Date(data.startDate) : null;
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    this.showOnlyOnce = data.showOnlyOnce !== undefined ? Boolean(data.showOnlyOnce) : false;
    this.showCountdown = data.showCountdown !== undefined ? Boolean(data.showCountdown) : true;
    this.badgeText = data.badgeText || null;
    this.theme = data.theme || 'general';
    this.triggerType = data.triggerType || 'combined';
    this.triggerDelay = data.triggerDelay !== undefined && data.triggerDelay !== null ? parseInt(data.triggerDelay, 10) : 8;
    this.triggerScrollPercent = data.triggerScrollPercent !== undefined && data.triggerScrollPercent !== null ? parseInt(data.triggerScrollPercent, 10) : 30;
    this.frequencyCap = data.frequencyCap || 'oncePerSession';
    this.deviceTargeting = data.deviceTargeting || 'both';
    this.isABTesting = data.isABTesting !== undefined ? Boolean(data.isABTesting) : false;
    this.variants = Array.isArray(data.variants) ? data.variants : [];
    this.impressions = data.impressions !== undefined && data.impressions !== null ? parseInt(data.impressions, 10) : 0;
    this.closes = data.closes !== undefined && data.closes !== null ? parseInt(data.closes, 10) : 0;
    this.ctaClicks = data.ctaClicks !== undefined && data.ctaClicks !== null ? parseInt(data.ctaClicks, 10) : 0;
    this.couponCopies = data.couponCopies !== undefined && data.couponCopies !== null ? parseInt(data.couponCopies, 10) : 0;
    this.conversions = data.conversions !== undefined && data.conversions !== null ? parseInt(data.conversions, 10) : 0;
    this.config = data.config || null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  async save() {
    const offerId = this.id || this._id;
    const dataToSave = {
      title: this.title || '',
      subtitle: this.subtitle || null,
      description: this.description || '',
      code: this.code || null,
      discountPercentage: this.discountPercentage !== undefined && this.discountPercentage !== null ? parseFloat(this.discountPercentage) : (this.discountPercent ? parseFloat(this.discountPercent) : null),
      discountPercent: this.discountPercent !== undefined && this.discountPercent !== null ? parseInt(this.discountPercent, 10) : 0,
      image: this.image || this.imageUrl || null,
      mobileImageUrl: this.mobileImageUrl || null,
      banner: this.banner || null,
      background: this.background || null,
      textColor: this.textColor || null,
      buttonText: this.buttonText || null,
      buttonLink: this.buttonLink || null,
      secondaryCtaText: this.secondaryCtaText || null,
      secondaryCtaLink: this.secondaryCtaLink || null,
      startDate: this.startDate ? new Date(this.startDate) : null,
      endDate: this.endDate ? new Date(this.endDate) : null,
      isActive: this.isActive !== false,
      showOnlyOnce: this.showOnlyOnce !== undefined ? Boolean(this.showOnlyOnce) : false,
      showCountdown: this.showCountdown !== undefined ? Boolean(this.showCountdown) : true,
      badgeText: this.badgeText || null,
      theme: this.theme || 'general',
      triggerType: this.triggerType || 'combined',
      triggerDelay: this.triggerDelay !== undefined && this.triggerDelay !== null ? parseInt(this.triggerDelay, 10) : 8,
      triggerScrollPercent: this.triggerScrollPercent !== undefined && this.triggerScrollPercent !== null ? parseInt(this.triggerScrollPercent, 10) : 30,
      frequencyCap: this.frequencyCap || 'oncePerSession',
      deviceTargeting: this.deviceTargeting || 'both',
      isABTesting: this.isABTesting !== undefined ? Boolean(this.isABTesting) : false,
      variants: Array.isArray(this.variants) ? this.variants : [],
      impressions: this.impressions !== undefined && this.impressions !== null ? parseInt(this.impressions, 10) : 0,
      closes: this.closes !== undefined && this.closes !== null ? parseInt(this.closes, 10) : 0,
      ctaClicks: this.ctaClicks !== undefined && this.ctaClicks !== null ? parseInt(this.ctaClicks, 10) : 0,
      couponCopies: this.couponCopies !== undefined && this.couponCopies !== null ? parseInt(this.couponCopies, 10) : 0,
      conversions: this.conversions !== undefined && this.conversions !== null ? parseInt(this.conversions, 10) : 0,
      config: this.config || null
    };

    const saved = await prisma.offer.upsert({
      where: { id: String(offerId) },
      update: dataToSave,
      create: {
        id: String(offerId),
        ...dataToSave
      }
    });

    Object.assign(this, saved);
    this._id = saved.id;
    this.imageUrl = saved.image;
    return this;
  }

  async deleteOne() {
    const offerId = this.id || this._id;
    try {
      await prisma.offer.delete({ where: { id: String(offerId) } });
      return true;
    } catch (e) {
      return false;
    }
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(o => new OfferDocument(o)));
      else if (res) resolve(new OfferDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class OfferModel extends OfferDocument {
  constructor(data) {
    super(data);
  }

  static find(where = {}) {
    const filter = cleanOfferWhere(where);
    const query = prisma.offer.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = cleanOfferWhere(where);
    const query = prisma.offer.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.offer.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new OfferDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const existing = await OfferModel.findById(id);
    if (!existing) return null;

    const dataToSet = update.$set ? update.$set : update;
    Object.assign(existing, dataToSet);
    await existing.save();
    return existing;
  }

  static async findByIdAndDelete(id) {
    if (!id) return null;
    try {
      const existing = await OfferModel.findById(id);
      if (existing) {
        await prisma.offer.delete({ where: { id: String(id) } });
        return existing;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static async deleteOne(where = {}) {
    const filter = cleanOfferWhere(where);
    try {
      const item = await prisma.offer.findFirst({ where: filter });
      if (item) {
        await prisma.offer.delete({ where: { id: item.id } });
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    } catch (e) {
      return { deletedCount: 0 };
    }
  }

  static async countDocuments(where = {}) {
    const filter = cleanOfferWhere(where);
    return await prisma.offer.count({ where: filter });
  }
}

module.exports = OfferModel;