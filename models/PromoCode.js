const prisma = require('../config/prisma');

const parseUntilDate = (inputDate) => {
  if (!inputDate) return null;
  const str = String(inputDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }
  const dateObj = new Date(inputDate);
  if (!isNaN(dateObj.getTime()) && dateObj.getUTCHours() === 0 && dateObj.getUTCMinutes() === 0 && dateObj.getUTCSeconds() === 0) {
    dateObj.setUTCHours(23, 59, 59, 999);
  }
  return dateObj;
};

class PromoCodeDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `promo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.code = data.code ? String(data.code).toUpperCase() : '';
    this.description = data.description || '';
    this.image = data.image || null;
    this.background = data.background || '#ffffff';
    this.discountType = data.discountType || 'percentage';
    this.discountValue = data.discountValue !== undefined && data.discountValue !== null ? parseFloat(data.discountValue) : 0;
    
    this.minOrderAmount = (data.minOrderAmount !== undefined && data.minOrderAmount !== null)
      ? parseFloat(data.minOrderAmount)
      : ((data.minimumOrderAmount !== undefined && data.minimumOrderAmount !== null) ? parseFloat(data.minimumOrderAmount) : null);
    this.minimumOrderAmount = this.minOrderAmount || 0;

    this.maxDiscountAmount = (data.maxDiscountAmount !== undefined && data.maxDiscountAmount !== null)
      ? parseFloat(data.maxDiscountAmount)
      : ((data.maximumDiscountAmount !== undefined && data.maximumDiscountAmount !== null) ? parseFloat(data.maximumDiscountAmount) : null);
    this.maximumDiscountAmount = this.maxDiscountAmount;

    this.usageLimit = data.usageLimit !== undefined && data.usageLimit !== null ? parseInt(data.usageLimit, 10) : null;
    this.usedCount = data.usedCount !== undefined && data.usedCount !== null ? parseInt(data.usedCount, 10) : 0;
    
    this.startDate = data.startDate || data.validFrom ? new Date(data.startDate || data.validFrom) : new Date();
    this.endDate = parseUntilDate(data.endDate || data.validUntil);
    this.validFrom = this.startDate;
    this.validUntil = this.endDate;

    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  populate() { return this; }

  isApplicableToOrder({ totalAmount = 0, items = [], userId = null } = {}) {
    if (!this.isActive) {
      return { valid: false, reason: 'This promo code is inactive' };
    }

    const now = new Date();
    if (this.validFrom && new Date(this.validFrom) > now) {
      return { valid: false, reason: 'This promo code is not valid yet' };
    }
    if (this.validUntil && new Date(this.validUntil) < now) {
      return { valid: false, reason: 'This promo code has expired' };
    }

    if (this.usageLimit !== null && this.usageLimit !== undefined && this.usedCount >= this.usageLimit) {
      return { valid: false, reason: 'This promo code usage limit has been reached' };
    }

    const minOrder = this.minimumOrderAmount || this.minOrderAmount || 0;
    if (totalAmount < minOrder) {
      return { valid: false, reason: `Minimum order amount of ₹${minOrder} is required for this promo code` };
    }

    return { valid: true };
  }

  calculateDiscount(totalAmount = 0) {
    if (!totalAmount || totalAmount <= 0) return 0;

    let discount = 0;
    if (this.discountType === 'percentage') {
      discount = (totalAmount * (parseFloat(this.discountValue) || 0)) / 100;
    } else {
      discount = parseFloat(this.discountValue) || 0;
    }

    const maxDiscount = this.maximumDiscountAmount || this.maxDiscountAmount;
    if (maxDiscount !== null && maxDiscount !== undefined && maxDiscount > 0) {
      discount = Math.min(discount, parseFloat(maxDiscount));
    }

    return Math.min(discount, totalAmount);
  }

  async deleteOne() {
    const promoId = this.id || this._id;
    try {
      await prisma.promoCode.delete({ where: { id: String(promoId) } });
      return true;
    } catch (e) {
      return false;
    }
  }

  async save() {
    const promoId = this.id || this._id;

    const rawStart = this.validFrom || this.startDate;
    const rawEnd = this.validUntil || this.endDate;

    const startDateVal = rawStart ? new Date(rawStart) : new Date();
    const endDateVal = rawEnd ? new Date(rawEnd) : null;

    const dataToSave = {
      code: this.code ? String(this.code).toUpperCase() : `CODE_${Date.now()}`,
      description: this.description || '',
      image: this.image || null,
      background: this.background || '#ffffff',
      discountType: this.discountType || 'percentage',
      discountValue: this.discountValue !== undefined && this.discountValue !== null ? parseFloat(this.discountValue) : 0,
      minOrderAmount: (this.minOrderAmount !== undefined && this.minOrderAmount !== null) ? parseFloat(this.minOrderAmount) : ((this.minimumOrderAmount !== undefined && this.minimumOrderAmount !== null) ? parseFloat(this.minimumOrderAmount) : null),
      maxDiscountAmount: (this.maxDiscountAmount !== undefined && this.maxDiscountAmount !== null) ? parseFloat(this.maxDiscountAmount) : ((this.maximumDiscountAmount !== undefined && this.maximumDiscountAmount !== null) ? parseFloat(this.maximumDiscountAmount) : null),
      minimumOrderAmount: (this.minOrderAmount !== undefined && this.minOrderAmount !== null) ? parseFloat(this.minOrderAmount) : ((this.minimumOrderAmount !== undefined && this.minimumOrderAmount !== null) ? parseFloat(this.minimumOrderAmount) : null),
      maximumDiscountAmount: (this.maxDiscountAmount !== undefined && this.maxDiscountAmount !== null) ? parseFloat(this.maxDiscountAmount) : ((this.maximumDiscountAmount !== undefined && this.maximumDiscountAmount !== null) ? parseFloat(this.maximumDiscountAmount) : null),
      validFrom: startDateVal,
      validUntil: endDateVal,
      applicableCategories: this.applicableCategories || undefined,
      excludedCategories: this.excludedCategories || undefined,
      applicableProducts: this.applicableProducts || undefined,
      excludedProducts: this.excludedProducts || undefined,
      firstTimeUserOnly: !!this.firstTimeUserOnly,
      createdBy: this.createdBy || null,
      metadata: this.metadata || undefined,
      usageLimit: this.usageLimit !== undefined && this.usageLimit !== null ? parseInt(this.usageLimit, 10) : null,
      usedCount: this.usedCount !== undefined && this.usedCount !== null ? parseInt(this.usedCount, 10) : 0,
      startDate: startDateVal,
      endDate: endDateVal,
      isActive: this.isActive !== false
    };

    const saved = await prisma.promoCode.upsert({
      where: { id: String(promoId) },
      update: dataToSave,
      create: {
        id: String(promoId),
        ...dataToSave
      }
    });

    Object.assign(this, saved);
    this.id = saved.id;
    this._id = saved.id;
    this.description = saved.description || '';
    this.image = saved.image || null;
    this.background = saved.background || '#ffffff';
    this.validFrom = saved.startDate;
    this.validUntil = saved.endDate;
    this.startDate = saved.startDate;
    this.endDate = saved.endDate;
    this.minimumOrderAmount = saved.minOrderAmount ? parseFloat(saved.minOrderAmount) : 0;
    this.maximumDiscountAmount = saved.maxDiscountAmount ? parseFloat(saved.maxDiscountAmount) : null;
    return this;
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
      if (Array.isArray(res)) resolve(res.map(i => new PromoCodeDocument(i)));
      else if (res) resolve(new PromoCodeDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class PromoCodeModel extends PromoCodeDocument {
  constructor(data) {
    super(data);
  }

  static findValidCodes(query = {}) {
    const now = new Date();
    const filter = {
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] }
      ]
    };
    const promise = prisma.promoCode.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(promise);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.code) filter.code = String(where.code).toUpperCase();
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.promoCode.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static find(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);

    const query = prisma.promoCode.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.promoCode.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new PromoCodeDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, update) {
    const existing = await PromoCodeModel.findById(id);
    if (!existing) return null;

    const dataToSet = update.$set ? update.$set : update;
    Object.assign(existing, dataToSet);
    await existing.save();
    return existing;
  }

  static async findByIdAndDelete(id) {
    if (!id) return null;
    try {
      const existing = await PromoCodeModel.findById(id);
      if (existing) {
        await prisma.promoCode.delete({ where: { id: String(id) } });
        return existing;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);
    return await prisma.promoCode.count({ where: filter });
  }

  static populate() { return this; }
}

module.exports = PromoCodeModel;