const prisma = require('../config/prisma');

class VendorDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.id = this._id;
    this.user = data.user && typeof data.user === 'object' ? data.user : (data.userId || data.user);
    this.bankDetails = data.bankDetails || {};
    this.storeLogo = data.storeLogo || null;
    this.storeBanner = data.storeBanner || null;
    this.storeAddress = data.storeAddress || {};
    this.contactInfo = data.contactInfo || {};
    this.businessInfo = data.businessInfo || {};
    this.commission = data.commission || { rate: 10, type: 'percentage' };
    this.verification = data.verification || { isVerified: false };
    this.subscription = data.subscription || {};
    this.storeSettings = data.storeSettings || {};
    this.salesSettings = data.salesSettings || {};
    this.analytics = data.analytics || { totalProducts: 0, totalOrders: 0, totalRevenue: 0 };
    this.socialMedia = data.socialMedia || {};
  }

  get fullAddress() {
    const a = this.storeAddress || {};
    return [a.street, a.city, a.state, a.zipCode, a.country].filter(Boolean).join(', ');
  }

  calculateEarnings(orderAmount = 0) {
    const rate = this.commission?.rate || 10;
    const isPercent = (this.commission?.type || 'percentage') === 'percentage';
    const platformCommission = isPercent ? (orderAmount * rate) / 100 : rate;
    const vendorEarnings = Math.max(0, orderAmount - platformCommission);
    return { orderAmount, platformCommission, vendorEarnings };
  }

  async updateAnalytics(orderAmount = 0, commission = 0) {
    const curr = this.analytics || {};
    this.analytics = {
      ...curr,
      totalOrders: (curr.totalOrders || 0) + 1,
      totalRevenue: (curr.totalRevenue || 0) + orderAmount,
      totalCommissionPaid: (curr.totalCommissionPaid || 0) + commission
    };
    return this.save();
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      userId: this.userId,
      user: this.user,
      storeName: this.storeName,
      storeDescription: this.storeDescription,
      storeLogo: this.storeLogo,
      storeBanner: this.storeBanner,
      ownerName: this.ownerName,
      status: this.status || 'pending',
      signatureImage: this.signatureImage,
      adminSignature: this.adminSignature,
      consentPdf: this.consentPdf,
      approvalPdf: this.approvalPdf,
      approvedAt: this.approvedAt,
      storeAddress: this.storeAddress,
      contactInfo: this.contactInfo,
      businessInfo: this.businessInfo,
      bankDetails: this.bankDetails,
      commission: this.commission,
      verification: this.verification,
      subscription: this.subscription,
      storeSettings: this.storeSettings,
      salesSettings: this.salesSettings,
      analytics: this.analytics,
      socialMedia: this.socialMedia,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const vId = this.id || this._id;
    const updated = await prisma.vendor.upsert({
      where: { id: vId },
      update: {
        ownerName: this.ownerName,
        storeName: this.storeName,
        storeDescription: this.storeDescription,
        storeLogo: this.storeLogo,
        storeBanner: this.storeBanner,
        status: this.status,
        signatureImage: this.signatureImage,
        adminSignature: this.adminSignature,
        consentPdf: this.consentPdf,
        approvalPdf: this.approvalPdf,
        approvedAt: this.approvedAt ? new Date(this.approvedAt) : undefined,
        storeAddress: this.storeAddress,
        contactInfo: this.contactInfo,
        businessInfo: this.businessInfo,
        bankDetails: this.bankDetails,
        commission: this.commission,
        verification: this.verification,
        subscription: this.subscription,
        storeSettings: this.storeSettings,
        salesSettings: this.salesSettings,
        analytics: this.analytics,
        socialMedia: this.socialMedia
      },
      create: {
        id: vId || `v_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: this.userId || (typeof this.user === 'string' ? this.user : ''),
        storeName: this.storeName || 'Vendor Store',
        storeDescription: this.storeDescription || null,
        storeLogo: this.storeLogo || null,
        storeBanner: this.storeBanner || null,
        ownerName: this.ownerName || null,
        status: this.status || 'pending',
        signatureImage: this.signatureImage || null,
        adminSignature: this.adminSignature || null,
        consentPdf: this.consentPdf || null,
        approvalPdf: this.approvalPdf || null,
        approvedAt: this.approvedAt ? new Date(this.approvedAt) : null,
        storeAddress: this.storeAddress || undefined,
        contactInfo: this.contactInfo || undefined,
        businessInfo: this.businessInfo || undefined,
        bankDetails: this.bankDetails || undefined,
        commission: this.commission || undefined,
        verification: this.verification || undefined,
        subscription: this.subscription || undefined,
        storeSettings: this.storeSettings || undefined,
        salesSettings: this.salesSettings || undefined,
        analytics: this.analytics || undefined,
        socialMedia: this.socialMedia || undefined
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) {
    this.prismaQuery = prismaQuery;
  }
  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(v => new VendorDocument(v)));
      else if (res) resolve(new VendorDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class VendorModel {
  static find(where = {}) {
    const filter = {};
    if (where.status) filter.status = where.status;

    const query = prisma.vendor.findMany({
      where: filter,
      include: { user: true, products: true, documents: true, payouts: true }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.userId || where.user) filter.userId = String(where.userId || where.user);
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.vendor.findFirst({
      where: filter,
      include: { user: true, products: true, documents: true }
    });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.vendor.findUnique({
      where: { id: String(id) },
      include: { user: true, products: true, documents: true }
    });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new VendorDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, update) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.vendor.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new VendorDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.vendor.delete({ where: { id: String(id) } });
      return new VendorDocument(deleted);
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.status) filter.status = where.status;
    return await prisma.vendor.count({ where: filter });
  }

  static populate() { return this; }
}

module.exports = VendorModel;