const prisma = require('../config/prisma');
const ValentineSettings = require('./ValentineSettings');

class ValentineOfferDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this._id = data.id || data._id || `val_off_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.id = this._id;
    this.title = data.title || '';
    this.description = data.description || '';
    this.type = data.type || 'discount';
    this.discountValue = data.discountValue ? parseFloat(data.discountValue) : null;
    this.minOrderAmount = data.minOrderAmount ? parseFloat(data.minOrderAmount) : null;
    this.freeItemName = data.freeItemName || null;
    this.products = data.products || [];
    this.code = data.code || null;
    this.image = data.image || null;
    this.badgeText = data.badgeText || null;
    this.badgeColor = data.badgeColor || null;
    this.startDate = data.startDate ? new Date(data.startDate) : null;
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.isActive = data.isActive !== false;
    this.usageCount = data.usageCount || 0;
    this.maxUsage = data.maxUsage || null;
    this.order = data.order || 0;
  }

  isValid() {
    if (!this.isActive) return false;
    const now = new Date();
    if (this.startDate && new Date(this.startDate) > now) return false;
    if (this.endDate && new Date(this.endDate) < now) return false;
    if (this.maxUsage && this.usageCount >= this.maxUsage) return false;
    return true;
  }

  async save() {
    try {
      const saved = await prisma.valentineOffer.upsert({
        where: { id: this.id },
        update: {
          title: this.title,
          description: this.description,
          type: this.type,
          discountValue: this.discountValue,
          minOrderAmount: this.minOrderAmount,
          freeItemName: this.freeItemName,
          products: this.products,
          code: this.code,
          image: this.image,
          badgeText: this.badgeText,
          badgeColor: this.badgeColor,
          startDate: this.startDate,
          endDate: this.endDate,
          isActive: this.isActive,
          usageCount: this.usageCount,
          maxUsage: this.maxUsage,
          order: this.order
        },
        create: {
          id: this.id,
          title: this.title,
          description: this.description,
          type: this.type,
          discountValue: this.discountValue,
          minOrderAmount: this.minOrderAmount,
          freeItemName: this.freeItemName,
          products: this.products,
          code: this.code,
          image: this.image,
          badgeText: this.badgeText,
          badgeColor: this.badgeColor,
          startDate: this.startDate,
          endDate: this.endDate,
          isActive: this.isActive,
          usageCount: this.usageCount,
          maxUsage: this.maxUsage,
          order: this.order
        }
      });
      Object.assign(this, saved);
    } catch (err) {
      // Fallback to ValentineSettings
      const settings = await ValentineSettings.getSettings();
      const offers = settings.offers || [];
      const index = offers.findIndex(o => (o.id || o._id) === this.id);
      if (index >= 0) offers[index] = { ...this };
      else offers.push({ ...this });
      settings.offers = offers;
      await settings.save();
    }
    return this;
  }

  toObject() {
    return { ...this };
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(v => new ValentineOfferDocument(v)));
      else if (res) resolve(new ValentineOfferDocument(res));
      else resolve([]);
    } catch (err) { reject(err); }
  }
}

class ValentineOfferModel {
  static find(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);
    const query = prisma.valentineOffer.findMany({ where: filter, orderBy: { order: 'asc' } }).catch(async () => {
      const s = await ValentineSettings.getSettings();
      let offers = s.offers || [];
      if (where.isActive !== undefined) offers = offers.filter(o => o.isActive === where.isActive);
      return offers;
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.id || where._id) filter.id = String(where.id || where._id);
    if (where.code) filter.code = String(where.code);
    const query = prisma.valentineOffer.findFirst({ where: filter }).catch(async () => {
      const s = await ValentineSettings.getSettings();
      const offers = s.offers || [];
      return offers.find(o => (o.id || o._id) === (where.id || where._id) || o.code === where.code) || null;
    });
    return new QueryChain(query);
  }

  static findById(id) {
    return this.findOne({ id });
  }

  static async getActiveOffers() {
    try {
      const list = await prisma.valentineOffer.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      });
      return list.map(v => new ValentineOfferDocument(v));
    } catch (e) {
      const settings = await ValentineSettings.getSettings();
      const offers = (settings.offers || []).filter(o => o.isActive !== false);
      return offers.map(v => new ValentineOfferDocument(v));
    }
  }

  static async create(data) {
    const doc = new ValentineOfferDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, update) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.valentineOffer.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new ValentineOfferDocument(updated);
    } catch (e) {
      const settings = await ValentineSettings.getSettings();
      const offers = settings.offers || [];
      const index = offers.findIndex(o => (o.id || o._id) === String(id));
      if (index === -1) return null;
      Object.assign(offers[index], dataToUpdate);
      settings.offers = offers;
      await settings.save();
      return new ValentineOfferDocument(offers[index]);
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.valentineOffer.delete({ where: { id: String(id) } });
      return new ValentineOfferDocument(deleted);
    } catch (e) {
      const settings = await ValentineSettings.getSettings();
      const offers = settings.offers || [];
      const index = offers.findIndex(o => (o.id || o._id) === String(id));
      if (index === -1) return null;
      const deleted = offers.splice(index, 1)[0];
      settings.offers = offers;
      await settings.save();
      return new ValentineOfferDocument(deleted);
    }
  }
}

module.exports = ValentineOfferModel;
